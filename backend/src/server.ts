import express from "express";
import cors from "cors";
import yts from "yt-search";
import { spawn } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import Genius from "genius-lyrics";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LISTENERS_FILE = join(__dirname, "../data/listeners.json");

interface ListenerRecord {
  id: string;
  name: string;
  lastSeen: number;
}

const listeners = new Map<string, ListenerRecord>();

function loadListeners() {
  try {
    if (!existsSync(LISTENERS_FILE)) return;
    const raw = readFileSync(LISTENERS_FILE, "utf-8");
    const list = JSON.parse(raw) as ListenerRecord[];
    list.forEach((entry) => listeners.set(entry.id, entry));
  } catch (err) {
    console.warn("Could not load listeners file:", err);
  }
}

function saveListeners() {
  try {
    mkdirSync(dirname(LISTENERS_FILE), { recursive: true });
    writeFileSync(LISTENERS_FILE, JSON.stringify(Array.from(listeners.values()), null, 2));
  } catch (err) {
    console.warn("Could not save listeners file:", err);
  }
}

loadListeners();

const geniusClient = new Genius.Client();
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

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || corsAllowList.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS not allowed for origin: ${origin}`));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
  })
);

app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// ──────────────────────────────────────────────
// API: Track who entered their name (no auth)
// ──────────────────────────────────────────────
const ONLINE_MS = 5 * 60 * 1000;

app.post("/api/listeners", (req, res) => {
  const { id, name } = req.body as { id?: string; name?: string };
  if (!id?.trim() || !name?.trim()) {
    res.status(400).json({ error: "id and name are required" });
    return;
  }
  const record: ListenerRecord = {
    id: id.trim(),
    name: name.trim().slice(0, 40),
    lastSeen: Date.now(),
  };
  listeners.set(record.id, record);
  saveListeners();
  res.json({ ok: true });
});

app.get("/api/listeners", (_req, res) => {
  const now = Date.now();
  const list = Array.from(listeners.values())
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .map((entry) => ({
      ...entry,
      online: now - entry.lastSeen < ONLINE_MS,
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

    res.setHeader("Content-Type", "audio/webm");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const ytdlpArgs = [
      "-f",
      YTDLP_FORMAT,
      "-o",
      "-",
      "--no-playlist",
      "--no-warnings",
      "--no-progress",
      "--quiet",
    ];

    if (startSec > 0) {
      ytdlpArgs.push("--download-sections", `*${formatSectionTime(startSec)}-`);
    }

    ytdlpArgs.push(videoUrl);

    const ytdlp = spawn(YTDLP_BIN, ytdlpArgs, { windowsHide: true });

    let bytesSent = 0;

    ytdlp.stdout.pipe(res);

    ytdlp.stderr.on("data", (data) => {
      const msg = data.toString().trim();
      if (msg && !msg.includes("JavaScript runtime")) {
        console.warn(`[yt-dlp stderr] ${msg}`);
      }
    });

    ytdlp.on("error", (err) => {
      console.error("Failed to start yt-dlp:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to start audio stream — is yt-dlp installed?" });
      }
    });

    ytdlp.stdout.on("data", (chunk: Buffer) => {
      bytesSent += chunk.length;
    });

    ytdlp.on("close", (code) => {
      if (code !== 0 && code !== null && bytesSent === 0 && !res.headersSent) {
        res.status(500).json({ error: "Audio stream failed — try another track" });
      }
    });

    // Ensure we kill the child process if the client disconnects or completes
    req.on("close", () => {
      try {
        ytdlp.kill("SIGTERM");
      } catch {
        // Already dead
      }
    });

    res.on("error", () => {
      try {
        ytdlp.kill("SIGTERM");
      } catch {
        // Already dead
      }
    });
  } catch (error) {
    console.error("Stream initialization error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Streaming failed" });
    }
  }
});

// ──────────────────────────────────────────────
// API: Get lyrics (using genius-lyrics scraping fallback)
// ──────────────────────────────────────────────
app.get("/api/lyrics", async (req, res) => {
  const title = req.query.title as string;
  const artist = req.query.artist as string;

  if (!title) {
    res.status(400).json({ error: "Missing song title" });
    return;
  }

  try {
    const query = artist ? `${title} ${artist}` : title;
    const searches = await geniusClient.songs.search(query);

    if (searches.length > 0) {
      const song = searches[0];
      const lyricsText = await song.lyrics();
      res.json({ lyrics: lyricsText });
    } else {
      res.json({ lyrics: "Lyrics not found." });
    }
  } catch (error) {
    console.warn("Lyrics unavailable:", error);
    res.json({ lyrics: "Lyrics not available right now." });
  }
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
