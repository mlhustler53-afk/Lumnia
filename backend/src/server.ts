import express from "express";
import cors from "cors";
import compression from "compression";
import http from "http";
import yts from "yt-search";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { fetchLyrics } from "./lyrics.js";
import { buildYtdlpArgs, streamViaYtdlp, validateYtdlp, autoUpdateYtdlp } from "./stream.js";
import { getCachedSearch, setCachedSearch } from "./searchCache.js";
import { getConcurrencyLimits } from "./concurrency.js";
import { getMemorySnapshot, startMemoryMonitor } from "./memoryMonitor.js";
import { getSearchCacheStats } from "./searchCache.js";
import { getStreamCacheStats } from "./streamCache.js";

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
  } catch {
    /* ignore corrupt file */
  }
}

function saveListeningStats() {
  try {
    mkdirSync(dirname(LISTENING_FILE), { recursive: true });
    writeFileSync(LISTENING_FILE, JSON.stringify(Array.from(listeningStats.values())));
  } catch {
    /* non-fatal */
  }
}

loadListeningStats();

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);
const API_TIMEOUT_MS = parseInt(process.env.API_TIMEOUT_MS || "30000", 10);
const STREAM_TIMEOUT_MS = parseInt(process.env.STREAM_TIMEOUT_MS || "300000", 10);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://lumnia-a2vb.vercel.app",
  ...(process.env.FRONTEND_URL?.split(",").map((o) => o.trim()) ?? []),
].filter(Boolean);

const corsAllowList = [...new Set(allowedOrigins)];

function isAllowedCorsOrigin(origin: string): boolean {
  if (corsAllowList.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname.endsWith(".vercel.app")) return true;
  } catch {
    return false;
  }
  return false;
}

app.disable("x-powered-by");

app.use(
  compression({
    threshold: 1024,
    level: 6,
    filter: (req, res) => {
      if (req.path === "/api/stream") return false;
      return compression.filter(req, res);
    },
  })
);

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

app.use((req, res, next) => {
  const isStream = req.path === "/api/stream";
  const timeout = isStream ? STREAM_TIMEOUT_MS : API_TIMEOUT_MS;
  req.setTimeout(timeout);
  res.setTimeout(timeout);
  res.on("timeout", () => {
    if (!res.headersSent) res.status(408).json({ error: "Request timeout" });
    res.destroy();
  });
  next();
});

function resolvePublicFrontendUrl(): string | null {
  const urls =
    process.env.FRONTEND_URL?.split(",").map((o) => o.trim()).filter(Boolean) ?? [];
  const publicUrl = urls.find((u) => !/localhost|127\.0\.0\.1/i.test(u));
  return publicUrl ?? urls[0] ?? null;
}

const FRONTEND_HOME = resolvePublicFrontendUrl();

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

app.get("/api/health", async (_req, res) => {
  const ytdlpStatus = await validateYtdlp(YTDLP_BIN);
  res.json({
    status: "ok",
    timestamp: Date.now(),
    platform: process.platform,
    memory: getMemorySnapshot(),
    concurrency: getConcurrencyLimits(),
    cache: {
      search: getSearchCacheStats(),
      streamUrls: getStreamCacheStats(),
    },
    ytdlp: {
      bin: YTDLP_BIN,
      ...ytdlpStatus,
    },
  });
});

const LISTENING_NOW_MS = 2 * 60 * 1000;

app.post("/api/listening", express.json({ limit: "8kb" }), (req, res) => {
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
      id: entry.id,
      name: entry.name,
      totalSeconds: entry.totalSeconds,
      lastActive: entry.lastActive,
      isListening: now - entry.lastActive < LISTENING_NOW_MS,
    }));
  res.json(list);
});

app.get("/api/search", async (req, res) => {
  const query = (req.query.q as string)?.trim();
  if (!query) {
    res.status(400).json({ error: "Missing query parameter 'q'" });
    return;
  }

  const cached = getCachedSearch(query);
  if (cached) {
    res.setHeader("X-Cache", "HIT");
    res.json(cached);
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
    setCachedSearch(query, videos);
    res.setHeader("X-Cache", "MISS");
    res.json(videos);
  } catch {
    res.status(500).json({ error: "Failed to search. Please try again." });
  }
});

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

app.get("/api/stream", async (req, res) => {
  const videoId = (req.query.id as string)?.trim();
  if (!videoId || !/^[a-zA-Z0-9_-]{6,32}$/.test(videoId)) {
    res.status(400).json({ error: "Invalid or missing video ID" });
    return;
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const ytdlpArgs = buildYtdlpArgs(videoUrl);
    const ok = await streamViaYtdlp(req, res, YTDLP_BIN, ytdlpArgs, videoId);
    if (!ok && !res.headersSent) {
      res.status(503).json({ error: "yt-dlp stream extraction failed." });
    }
  } catch {
    if (!res.headersSent) {
      res.status(500).json({ error: "Streaming failed" });
    }
  }
});

app.get("/api/lyrics", async (req, res) => {
  const title = (req.query.title as string)?.trim();
  const artist = (req.query.artist as string)?.trim();

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

const server = http.createServer(app);
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = STREAM_TIMEOUT_MS;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Lumina Backend http://localhost:${PORT}`);
  console.log(`yt-dlp: ${YTDLP_BIN}`);
  console.log(
    `Limits: streams=${process.env.STREAM_MAX_CONCURRENT || 3} ytdlp=${process.env.YTDLP_MAX_CONCURRENT || 2} RAM=${process.env.MEMORY_LIMIT_MB || 512}MB`
  );

  startMemoryMonitor();

  validateYtdlp(YTDLP_BIN).then((ytCheck) => {
    if (!ytCheck.ok) {
      console.error(`yt-dlp validation failed: ${ytCheck.error}`);
    }
  });

  if (process.env.LOW_MEMORY !== "1") {
    autoUpdateYtdlp(YTDLP_BIN);
  }
});
