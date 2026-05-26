import { spawn, execFile, type ChildProcess } from "child_process";
import { existsSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { Response, Request } from "express";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BOT_ERROR_RE = /not a bot|LOGIN_REQUIRED|Sign in to confirm|bot detection/i;

// ──────────────────────────────────────────────
// Cookie support: decode YTDLP_COOKIES_BASE64 env var to a file at import time
// ──────────────────────────────────────────────
let resolvedCookiePath: string | null = null;

// Default User-Agent — can be overridden via YT_USER_AGENT env var to match
// the exact browser the cookies were exported from.
const YT_USER_AGENT: string | null = process.env.YT_USER_AGENT?.trim() || null;

function setupCookies(): string | null {
  // 1. Render Secret File — uploaded via Render's "Secret Files" feature
  const renderSecretPath = "/opt/render/project/src/youtube-cookies.txt";
  if (existsSync(renderSecretPath)) {
    console.log(`[cookies] Using Render secret file: ${renderSecretPath}`);
    return renderSecretPath;
  }

  // 2. cookies.txt next to the running process (works on any platform)
  const cwdCookiePath = join(process.cwd(), "cookies.txt");
  if (existsSync(cwdCookiePath)) {
    console.log(`[cookies] Using cwd cookie file: ${cwdCookiePath}`);
    return cwdCookiePath;
  }

  // 3. Explicit file path from env
  const fromFile = process.env.YTDLP_COOKIES?.trim();
  if (fromFile && existsSync(fromFile)) {
    console.log(`[cookies] Using cookie file: ${fromFile}`);
    return fromFile;
  }

  // 4. Base64-encoded cookie string → decode to a temp file
  const fromBase64 = process.env.YTDLP_COOKIES_BASE64?.trim();
  if (fromBase64) {
    try {
      const decoded = Buffer.from(fromBase64, "base64").toString("utf-8");
      if (!decoded.includes("youtube.com") && !decoded.includes(".youtube.")) {
        console.warn("[cookies] YTDLP_COOKIES_BASE64 decoded but doesn't look like YouTube cookies");
      }
      const dataDir = join(__dirname, "../data");
      mkdirSync(dataDir, { recursive: true });
      const cookiePath = join(dataDir, "cookies.txt");
      writeFileSync(cookiePath, decoded, "utf-8");
      console.log(`[cookies] Decoded YTDLP_COOKIES_BASE64 → ${cookiePath} (${decoded.length} chars)`);
      return cookiePath;
    } catch (err) {
      console.error("[cookies] Failed to decode YTDLP_COOKIES_BASE64:", err);
    }
  }

  console.warn("[cookies] No cookie file found — yt-dlp may get bot-blocked on cloud servers");
  return null;
}

resolvedCookiePath = setupCookies();
if (YT_USER_AGENT) {
  console.log(`[cookies] Custom User-Agent: ${YT_USER_AGENT.slice(0, 60)}…`);
}

/**
 * Validate that yt-dlp binary exists and runs on this platform.
 * Call at startup so Render logs show immediately if something is wrong.
 */
export function validateYtdlp(bin: string): Promise<{ ok: boolean; version?: string; error?: string; cookies: boolean }> {
  return new Promise((resolve) => {
    execFile(bin, ["--version"], {
      timeout: 45000,
      windowsHide: true,
    }, (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, error: err.message || String(err), cookies: !!resolvedCookiePath });
      } else {
        resolve({ ok: true, version: stdout.trim(), cookies: !!resolvedCookiePath });
      }
    });
  });
}

/**
 * Download the absolute latest release of yt-dlp on startup in the background.
 * YouTube frequently changes its streaming formats, requiring latest updates.
 */
export async function autoUpdateYtdlp(dest: string): Promise<void> {
  if (process.platform === "win32") {
    console.log("[update] Auto-update skipped on Windows local machine to avoid EPERM file locks.");
    return;
  }
  if (process.env.SKIP_YTDLP_UPDATE === "1") {
    console.log("[update] Auto-update skipped (SKIP_YTDLP_UPDATE=1)");
    return;
  }
  console.log("[update] Checking/updating to latest yt-dlp release in background...");
  const YTDLP_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

  try {
    const res = await fetch(YTDLP_URL, {
      signal: AbortSignal.timeout(120000),
      redirect: "follow",
    });
    if (!res.ok) {
      throw new Error(`Download failed: HTTP ${res.status} ${res.statusText}`);
    }
    if (!res.body) {
      throw new Error("No response body received");
    }

    const { createWriteStream, chmodSync, renameSync } = await import("fs");
    const { pipeline } = await import("stream/promises");
    const { Readable } = await import("stream");

    const tempDest = dest + ".tmp";
    const fileStream = createWriteStream(tempDest);
    const nodeStream = Readable.fromWeb(res.body as any);
    await pipeline(nodeStream, fileStream);

    chmodSync(tempDest, 0o755);
    renameSync(tempDest, dest);
    console.log(`[update] ✅ Successfully updated yt-dlp to latest version at ${dest}`);
  } catch (err: any) {
    console.error("[update] ❌ Failed to auto-update yt-dlp:", err.message ?? err);
  }
}

export function buildYtdlpArgs(
  videoUrl: string,
  format: string,
  startSec: number,
  formatSectionTime: (s: number) => string,
  useSpoofing: boolean = true
): string[] {
  const args = [
    "-f",
    format,
    "-o",
    "-",
    "--no-playlist",
    "--no-warnings",
    "--no-progress",
    "--prefer-free-formats",
    "--no-check-certificates",
  ];

  // ── Cookie auth (critical for cloud deployments) ──────────────
  if (resolvedCookiePath && existsSync(resolvedCookiePath)) {
    args.push("--cookies", resolvedCookiePath);
  }

  // ── Client spoofing — mimic official app to bypass datacenter blocks ──
  if (useSpoofing) {
    args.push(
      "--extractor-args",
      "youtube:player-client=ios,web_creator"
    );
  }

  // ── User-Agent — must match the browser the cookies were exported from ──
  if (YT_USER_AGENT) {
    args.push("--user-agent", YT_USER_AGENT);
  }

  if (startSec > 0) {
    args.push("--download-sections", `*${formatSectionTime(startSec)}-`);
  }

  args.push(videoUrl);
  return args;
}

export function streamViaYtdlp(
  req: Request,
  res: Response,
  ytdlpBin: string,
  args: string[]
): Promise<boolean> {
  return new Promise((resolve) => {
    let bytesSent = 0;
    let settled = false;
    let stderrLog = "";
    let proc: ChildProcess | null = null;

    try {
      proc = spawn(ytdlpBin, args, { windowsHide: true });
    } catch (err) {
      console.error("[yt-dlp] Failed to spawn:", err);
      resolve(false);
      return;
    }

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    const kill = () => {
      try {
        proc?.kill("SIGTERM");
      } catch {
        /* already dead */
      }
    };

    proc.on("error", (err) => {
      console.error("[yt-dlp] Process error:", err.message);
      kill();
      finish(false);
    });

    proc.stderr?.on("data", (data) => {
      const msg = data.toString();
      stderrLog += msg;
      if (BOT_ERROR_RE.test(msg)) {
        kill();
        finish(false);
      } else if (msg.trim() && !msg.includes("JavaScript runtime")) {
        console.warn(`[yt-dlp stderr] ${msg.trim()}`);
      }
    });

    proc.stdout?.on("data", (chunk: Buffer) => {
      if (bytesSent === 0) {
        res.setHeader("Content-Type", "audio/webm");
        res.setHeader("Transfer-Encoding", "chunked");
        res.setHeader("Cache-Control", "no-cache, no-store");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Content-Type-Options", "nosniff");
      }
      bytesSent += chunk.length;
      res.write(chunk);
    });

    proc.on("close", (code) => {
      if (bytesSent > 0) {
        if (!res.writableEnded) res.end();
        finish(true);
      } else {
        if (stderrLog.trim()) {
          console.error(`[yt-dlp] Exited code=${code}, 0 bytes sent. stderr:\n${stderrLog.trim()}`);
        }
        kill();
        finish(false);
      }
    });

    req.on("close", kill);
    res.on("error", kill);
  });
}

// ──────────────────────────────────────────────
// Fallback 1: Invidious API
// ──────────────────────────────────────────────
interface InvidiousAdaptiveFormat {
  url?: string;
  type?: string;
  bitrate?: string;
  encoding?: string;
  container?: string;
}

interface InvidiousVideoResponse {
  adaptiveFormats?: InvidiousAdaptiveFormat[];
}

// Updated with currently working instances (May 2026)
const INVIDIOUS_INSTANCES_HARDCODED = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://invidious.jing.rocks",
  "https://iv.nbocloud.com",
  "https://invidious.privacyredirect.com",
  "https://invidious.perennialte.ch",
  "https://invidious.materialio.us",
  "https://yt.drgnz.club",
  "https://invidious.protokolla.fi",
];

// Dynamic instance list — populated at startup from the official registry
let dynamicInvidiousInstances: string[] = [];

/**
 * Fetch the current list of healthy Invidious instances from the official API.
 * Called once at startup; results are cached in-memory.
 */
export async function refreshInvidiousInstances(): Promise<void> {
  try {
    const res = await fetch("https://api.invidious.io/instances.json?sort_by=type,health", {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return;
    const data = (await res.json()) as [string, { type: string; uri: string; stats?: { playback?: { ratio?: number } }; monitor?: { uptime_30d?: number } }][];
    dynamicInvidiousInstances = data
      .filter(([, info]) => {
        if (info.type !== "https") return false;
        // Prefer instances with some playback success
        const ratio = info.stats?.playback?.ratio ?? -1;
        const uptime = info.monitor?.uptime_30d ?? 0;
        return uptime > 90 || ratio > 0;
      })
      .map(([, info]) => info.uri)
      .slice(0, 10);
    console.log(`[invidious] Fetched ${dynamicInvidiousInstances.length} healthy instances from registry`);
  } catch (err) {
    console.warn("[invidious] Could not fetch instance list:", (err as Error).message ?? err);
  }
}

function getInvidiousOrigins(): string[] {
  const fromEnv = process.env.INVIDIOUS_API_URL?.trim();
  const all = [
    ...(fromEnv ? [fromEnv] : []),
    ...dynamicInvidiousInstances,
    ...INVIDIOUS_INSTANCES_HARDCODED,
  ];
  return [...new Set(all)];
}

async function fetchInvidiousAudio(
  apiOrigin: string,
  videoId: string
): Promise<{ url: string; mimeType: string } | null> {
  try {
    const endpoint = `${apiOrigin}/api/v1/videos/${encodeURIComponent(videoId)}?fields=adaptiveFormats`;
    const res = await fetch(endpoint, {
      headers: { "User-Agent": "LuminaMusic/1.0" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;

    const text = await res.text();
    let data: InvidiousVideoResponse;
    try {
      data = JSON.parse(text);
    } catch {
      console.warn(`[invidious] ${apiOrigin} returned non-JSON: ${text.slice(0, 80)}`);
      return null;
    }

    const audioFormats = (data.adaptiveFormats ?? []).filter(
      (f) => f.type?.startsWith("audio/") && f.url
    );
    if (!audioFormats.length) return null;

    // Prefer opus/webm, then m4a
    const preferred =
      audioFormats.find((f) => f.container === "webm" || f.type?.includes("opus")) ??
      audioFormats[0];

    return {
      url: preferred.url!,
      mimeType: preferred.type?.split(";")[0] ?? "audio/webm",
    };
  } catch (err) {
    console.warn(`[invidious] ${apiOrigin} failed:`, (err as Error).message ?? err);
    return null;
  }
}

export async function streamViaInvidious(
  req: Request,
  res: Response,
  videoId: string
): Promise<boolean> {
  const origins = getInvidiousOrigins();

  for (const origin of origins) {
    try {
      const audio = await fetchInvidiousAudio(origin, videoId);
      if (!audio?.url) continue;

      const upstream = await fetch(audio.url, {
        headers: { "User-Agent": "LuminaMusic/1.0" },
        signal: AbortSignal.timeout(120000),
      });

      if (!upstream.ok || !upstream.body) continue;

      res.setHeader("Content-Type", audio.mimeType);
      res.setHeader("Transfer-Encoding", "chunked");
      res.setHeader("Cache-Control", "no-cache, no-store");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Content-Type-Options", "nosniff");

      const nodeStream = Readable.fromWeb(
        upstream.body as import("stream/web").ReadableStream
      );
      await pipeline(nodeStream, res);
      console.log(`[invidious fallback] streaming via ${origin}`);
      return true;
    } catch (err) {
      console.warn(`[invidious fallback] ${origin} failed:`, (err as Error).message ?? err);
    }
  }

  return false;
}

// ──────────────────────────────────────────────
// Fallback 2: Piped API
// ──────────────────────────────────────────────
interface PipedAudioStream {
  url: string;
  mimeType?: string;
  bitrate?: number;
}

interface PipedStreamsResponse {
  audioStreams?: PipedAudioStream[];
}

// Updated with currently working instances (May 2026)
const PIPED_API_INSTANCES_HARDCODED = [
  "https://api.piped.private.coffee",
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.leptons.xyz",
];

// Dynamic instance list — populated at startup from the official registry
let dynamicPipedInstances: string[] = [];

/**
 * Fetch the current list of healthy Piped API instances from the official registry.
 * Called once at startup; results are cached in-memory.
 */
export async function refreshPipedInstances(): Promise<void> {
  try {
    const res = await fetch("https://piped-instances.kavin.rocks/", {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { name: string; api_url: string; uptime_24h?: number; uptime_30d?: number }[];
    dynamicPipedInstances = data
      .filter((inst) => {
        const uptime = inst.uptime_24h ?? inst.uptime_30d ?? 0;
        return uptime > 80 && inst.api_url;
      })
      .map((inst) => inst.api_url.replace(/\/+$/, ""))
      .slice(0, 8);
    console.log(`[piped] Fetched ${dynamicPipedInstances.length} healthy instances from registry`);
  } catch (err) {
    console.warn("[piped] Could not fetch instance list:", (err as Error).message ?? err);
  }
}

function normalizePipedApiBase(raw?: string): string | null {
  if (!raw?.trim()) return null;
  let base = raw.trim();
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  try {
    const url = new URL(base);
    let path = url.pathname.replace(/\/+$/, "");
    if (path.endsWith("/streams")) path = path.slice(0, -"/streams".length);
    url.pathname = path || "/";
    return url.origin;
  } catch {
    return null;
  }
}

function getPipedApiOrigins(): string[] {
  const fromEnv = normalizePipedApiBase(process.env.PIPED_API_URL);
  const all = [
    ...(fromEnv ? [fromEnv] : []),
    ...dynamicPipedInstances,
    ...PIPED_API_INSTANCES_HARDCODED,
  ];
  return [...new Set(all)];
}

async function fetchPipedAudio(
  apiOrigin: string,
  videoId: string
): Promise<PipedAudioStream | null> {
  // Build URL safely — ensure no hostname concatenation bug
  const cleanOrigin = apiOrigin.replace(/\/+$/, "");
  const endpoint = `${cleanOrigin}/streams/${encodeURIComponent(videoId)}`;

  const metaRes = await fetch(endpoint, {
    headers: { "User-Agent": "LuminaMusic/1.0" },
    signal: AbortSignal.timeout(12000),
  });

  if (!metaRes.ok) return null;

  // Guard against non-JSON responses (e.g. "Service has been shut down")
  const text = await metaRes.text();
  let data: PipedStreamsResponse;
  try {
    data = JSON.parse(text);
  } catch {
    console.warn(`[piped] ${apiOrigin} returned non-JSON: ${text.slice(0, 80)}`);
    return null;
  }

  return (
    [...(data.audioStreams ?? [])].sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0] ??
    null
  );
}

export async function streamViaPiped(
  req: Request,
  res: Response,
  videoId: string
): Promise<boolean> {
  const origins = getPipedApiOrigins();

  for (const origin of origins) {
    try {
      const audio = await fetchPipedAudio(origin, videoId);
      if (!audio?.url) continue;

      const upstream = await fetch(audio.url, {
        headers: { "User-Agent": "LuminaMusic/1.0" },
        signal: AbortSignal.timeout(120000),
      });

      if (!upstream.ok || !upstream.body) continue;

      res.setHeader("Content-Type", audio.mimeType || "audio/webm");
      res.setHeader("Transfer-Encoding", "chunked");
      res.setHeader("Cache-Control", "no-cache, no-store");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Content-Type-Options", "nosniff");

      const nodeStream = Readable.fromWeb(
        upstream.body as import("stream/web").ReadableStream
      );
      await pipeline(nodeStream, res);
      console.log(`[piped fallback] streaming via ${origin}`);
      return true;
    } catch (err) {
      console.warn(`[piped fallback] ${origin} failed:`, (err as Error).message ?? err);
    }
  }

  return false;
}

// ──────────────────────────────────────────────
// Fallback 3: Cobalt API (very reliable YouTube audio extractor)
// ──────────────────────────────────────────────
const COBALT_API_INSTANCES = [
  "https://cobalt-api.kwiatekmiki.com",
  "https://cobalt.api.timelessnesses.me",
  "https://cobalt-api.ayo.tf",
];

function getCobaltApiOrigins(): string[] {
  const fromEnv = process.env.COBALT_API_URL?.trim();
  const all = fromEnv ? [fromEnv, ...COBALT_API_INSTANCES] : COBALT_API_INSTANCES;
  return [...new Set(all)];
}

interface CobaltResponse {
  status: string;
  url?: string;
  audio?: string;
}

export async function streamViaCobalt(
  req: Request,
  res: Response,
  videoId: string
): Promise<boolean> {
  const origins = getCobaltApiOrigins();
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  for (const origin of origins) {
    try {
      const endpoint = `${origin.replace(/\/+$/, "")}`;
      const metaRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "LuminaMusic/1.0",
        },
        body: JSON.stringify({
          url: videoUrl,
          downloadMode: "audio",
          audioFormat: "opus",
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!metaRes.ok) {
        console.warn(`[cobalt] ${origin} returned HTTP ${metaRes.status}`);
        continue;
      }

      const text = await metaRes.text();
      let data: CobaltResponse;
      try {
        data = JSON.parse(text);
      } catch {
        console.warn(`[cobalt] ${origin} returned non-JSON: ${text.slice(0, 80)}`);
        continue;
      }

      const audioUrl = data.url || data.audio;
      if (!audioUrl) {
        console.warn(`[cobalt] ${origin} returned no audio URL, status: ${data.status}`);
        continue;
      }

      // Stream the audio
      const upstream = await fetch(audioUrl, {
        headers: { "User-Agent": "LuminaMusic/1.0" },
        signal: AbortSignal.timeout(120000),
      });

      if (!upstream.ok || !upstream.body) continue;

      const contentType = upstream.headers.get("content-type") || "audio/ogg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Transfer-Encoding", "chunked");
      res.setHeader("Cache-Control", "no-cache, no-store");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Content-Type-Options", "nosniff");

      const nodeStream = Readable.fromWeb(
        upstream.body as import("stream/web").ReadableStream
      );
      await pipeline(nodeStream, res);
      console.log(`[cobalt fallback] streaming via ${origin}`);
      return true;
    } catch (err) {
      console.warn(`[cobalt fallback] ${origin} failed:`, (err as Error).message ?? err);
    }
  }

  return false;
}

// ──────────────────────────────────────────────
// Initialize dynamic instance lists at startup
// ──────────────────────────────────────────────
export async function initStreamingInstances(): Promise<void> {
  console.log("[stream] Fetching live instance lists from registries...");
  await Promise.allSettled([
    refreshInvidiousInstances(),
    refreshPipedInstances(),
  ]);
  console.log("[stream] Instance discovery complete");
}
