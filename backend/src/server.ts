import express from "express";
import cors from "cors";
import yts from "yt-search";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { fetchLyrics } from "./lyrics.js";
import { buildYtdlpArgs, streamViaPiped, streamViaYtdlp } from "./stream.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LISTENING_FILE = join(__dirname, "../data/listening.json");

interface ListeningRecord {
  id: string;
  name: string;
  totalSeconds: number;
  lastActive: number;
}

const listeningStats = new Map<string, ListeningRecord>();

function loadListeningStats() {
  try {
    if (!existsSync(LISTENING_FILE)) return;
    const raw = readFileSync(LISTENING_FILE, "utf-8");
    const list = JSON.parse(raw) as ListeningRecord[];
    list.forEach((entry) => listeningStats.set(entry.id, entry));
  } catch (err) {
    console.warn("Could not load listening stats file:", err);
  }
}

function saveListeningStats() {
  try {
    mkdirSync(dirname(LISTENING_FILE), { recursive: true });
    writeFileSync(LISTENING_FILE, JSON.stringify(Array.from(listeningStats.values()), null, 2));
  } catch (err) {
    console.warn("Could not save listening stats file:", err);
  }
}

loadListeningStats();

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// CORS — allow frontend origin(s); FRONTEND_URL can be comma-separated
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://lumnia-a2vb.vercel.app",
  ...(process.env.FRONTEND_URL?.split(",").map((o) => o.trim()) ?? []),
].filter(Boolean);

const corsAllowList = [...new Set(allowedOrigins)];

function isAllowedCorsOrigin(origin: string): boolean {
  if (corsAllowList.includes(origin)) return true;
  // Vercel production + preview deployments
  try {
    const { hostname } = new URL(origin);
    if (hostname.endsWith(".vercel.app")) return true;
  } catch {
    return false;
  }
  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isAllowedCorsOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS not allowed for origin: ${origin}`));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
  })
);

app.use(express.json());

const FRONTEND_HOME =
  process.env.FRONTEND_URL?.split(",")
    .map((o) => o.trim())
    .find(Boolean) ?? null;

// Root — browsers often open the Render URL directly (not an error if API-only)
app.get("/", (req, res) => {
  if (FRONTEND_HOME && req.accepts("html")) {
    res.redirect(302, FRONTEND_HOME);
    return;
  }
  res.json({
    name: "Lumina API",
    status: "ok",
    message: "Backend is running. Open the frontend app to use Lumina.",
    frontend: FRONTEND_HOME,
    health: "/api/health",
    endpoints: "/api",
  });
});

app.get("/api", (_req, res) => {
  res.json({
    search: "GET /api/search?q=",
    stream: "GET /api/stream?id=VIDEO_ID",
    lyrics: "GET /api/lyrics?title=&artist=",
    listening: "GET /api/listening · POST /api/listening",
    health: "GET /api/health",
  });
});

app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// ──────────────────────────────────────────────
// API: Listening time (accumulated while music plays)
// ──────────────────────────────────────────────
const LISTENING_NOW_MS = 2 * 60 * 1000;

app.post("/api/listening", (req, res) => {
  const { id, name, seconds } = req.body as {
    id?: string;
    name?: string;
    seconds?: number;
  };
  if (!id?.trim() || !name?.trim()) {
    res.status(400).json({ error: "id and name are required" });
    return;
  }

  const delta = Math.min(Math.max(0, Math.floor(Number(seconds) || 0)), 3600);
  const key = id.trim();
  const existing = listeningStats.get(key);
  const record: ListeningRecord = {
    id: key,
    name: name.trim().slice(0, 40),
    totalSeconds: (existing?.totalSeconds ?? 0) + delta,
    lastActive: Date.now(),
  };
  listeningStats.set(key, record);
  saveListeningStats();
  res.json({ ok: true, totalSeconds: record.totalSeconds });
});

app.get("/api/listening", (_req, res) => {
  const now = Date.now();
  const list = Array.from(listeningStats.values())
    .sort((a, b) => b.totalSeconds - a.totalSeconds)
    .map((entry) => ({
      ...entry,
      isListening: now - entry.lastActive < LISTENING_NOW_MS,
    }));
  res.json(list);
});

// ──────────────────────────────────────────────
// API: Search music via YouTube
// ──────────────────────────────────────────────
app.get("/api/search", async (req, res) => {
  const query = req.query.q as string;
  if (!query) {
    res.status(400).json({ error: "Missing query parameter 'q'" });
    return;
  }

  try {
    const result = await yts(query);
    const videos = result.videos.slice(0, 12).map((v) => ({
      id: v.videoId,
      title: v.title,
      thumbnail: v.thumbnail,
      author: v.author.name,
      duration: v.timestamp,
      url: v.url,
    }));
    res.json(videos);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Failed to search. Please try again." });
  }
});

function formatSectionTime(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Resolve yt-dlp: env → backend dir (from build) → cwd → PATH. */
function resolveYtDlp(): string {
  const fromEnv = process.env.YTDLP_PATH?.trim();
  if (fromEnv) return fromEnv;

  const names = process.platform === "win32" ? ["yt-dlp.exe", "yt-dlp"] : ["yt-dlp"];
  const searchRoots = [
    join(__dirname, ".."),
    process.cwd(),
    join(process.cwd(), "backend"),
  ];

  for (const root of searchRoots) {
    for (const name of names) {
      const local = join(root, name);
      if (existsSync(local)) return local;
    }
  }

  return process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
}

const YTDLP_BIN = resolveYtDlp();
const YTDLP_FORMAT = "bestaudio[ext=webm]/bestaudio/best";

// ──────────────────────────────────────────────
// API: Stream audio from YouTube (proxy via yt-dlp)
// Optional ?t=seconds to start playback from a position
// ──────────────────────────────────────────────
app.get("/api/stream", async (req, res) => {
  const videoId = req.query.id as string;
  if (!videoId) {
    res.status(400).json({ error: "Missing video ID" });
    return;
  }

  const startSec = Math.max(0, parseInt(req.query.t as string, 10) || 0);

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const ytdlpArgs = buildYtdlpArgs(videoUrl, YTDLP_FORMAT, startSec, formatSectionTime);

    let ok = await streamViaYtdlp(req, res, YTDLP_BIN, ytdlpArgs);

    if (!ok && !res.headersSent) {
      console.warn(`[stream] yt-dlp failed for ${videoId}, trying Piped fallback`);
      ok = await streamViaPiped(req, res, videoId);
    }

    if (!ok && !res.headersSent) {
      res.status(503).json({
        error:
          "Streaming blocked by YouTube on this server. Add YTDLP_COOKIES on Render (see backend/.env.example) or try another track.",
      });
    }
  } catch (error) {
    console.error("Stream initialization error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Streaming failed" });
    }
  }
});

// ──────────────────────────────────────────────
// API: Get lyrics (LRCLIB — no Genius scraping)
// ──────────────────────────────────────────────
app.get("/api/lyrics", async (req, res) => {
  const title = req.query.title as string;
  const artist = req.query.artist as string;

  if (!title) {
    res.status(400).json({ error: "Missing song title" });
    return;
  }

  const lyrics = await fetchLyrics(title, artist);
  res.json({ lyrics });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path,
    hint: "API routes live under /api — see GET /api for a list.",
  });
});

// ──────────────────────────────────────────────
// Start server
// ──────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Lumina Backend running on http://localhost:${PORT}`);
  console.log(`   yt-dlp: ${YTDLP_BIN}`);
  console.log(`   Allowed origins: ${corsAllowList.join(", ")}`);
  if (!existsSync(YTDLP_BIN)) {
    console.warn(`   ⚠ yt-dlp not found at "${YTDLP_BIN}" — streaming will fail until build installs it`);
  }
});
