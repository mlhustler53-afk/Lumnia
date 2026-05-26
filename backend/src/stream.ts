import { execFile } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { Request, Response } from "express";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { getCachedStreamUrl, setCachedStreamUrl } from "./streamCache.js";
import {
  acquireYtdlpSlot,
  dedupeUrlExtraction,
  releaseStreamSlot,
  tryAcquireStreamSlot,
} from "./concurrency.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_YT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const YT_USER_AGENT = process.env.YT_USER_AGENT?.trim() || DEFAULT_YT_USER_AGENT;

/** stdout from yt-dlp -g is a single URL line; keep buffer tiny. */
const YTDLP_MAX_BUFFER = 256 * 1024;

let resolvedCookiePath: string | null = null;

function setupCookies(): string | null {
  const renderSecretPath = "/opt/render/project/src/youtube-cookies.txt";
  if (existsSync(renderSecretPath)) return renderSecretPath;

  const cwdCookiePath = join(process.cwd(), "cookies.txt");
  if (existsSync(cwdCookiePath)) return cwdCookiePath;

  const fromFile = process.env.YTDLP_COOKIES?.trim();
  if (fromFile && existsSync(fromFile)) return fromFile;

  const fromBase64 = process.env.YTDLP_COOKIES_BASE64?.trim();
  if (fromBase64) {
    try {
      const decoded = Buffer.from(fromBase64, "base64").toString("utf-8");
      const dataDir = join(__dirname, "../data");
      mkdirSync(dataDir, { recursive: true });
      const cookiePath = join(dataDir, "cookies.txt");
      writeFileSync(cookiePath, decoded, "utf-8");
      return cookiePath;
    } catch (err) {
      console.error("[cookies] Failed to decode YTDLP_COOKIES_BASE64:", err);
    }
  }

  return null;
}

resolvedCookiePath = setupCookies();

export function validateYtdlp(
  bin: string
): Promise<{ ok: boolean; version?: string; error?: string; cookies: boolean }> {
  return new Promise((resolve) => {
    execFile(
      bin,
      ["--version"],
      {
        timeout: 45000,
        windowsHide: true,
        maxBuffer: 4096,
      },
      (err, stdout) => {
        if (err) {
          resolve({ ok: false, error: err.message || String(err), cookies: !!resolvedCookiePath });
          return;
        }
        resolve({ ok: true, version: stdout.trim(), cookies: !!resolvedCookiePath });
      }
    );
  });
}

export async function autoUpdateYtdlp(dest: string): Promise<void> {
  if (process.platform === "win32") return;
  if (process.env.SKIP_YTDLP_UPDATE === "1") return;
  if (process.env.LOW_MEMORY === "1") return;

  const YTDLP_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
  try {
    const res = await fetch(YTDLP_URL, {
      signal: AbortSignal.timeout(120000),
      redirect: "follow",
    });
    if (!res.ok || !res.body) return;

    const { createWriteStream, chmodSync, renameSync } = await import("fs");
    const tempDest = `${dest}.tmp`;
    const fileStream = createWriteStream(tempDest);
    const nodeStream = Readable.fromWeb(res.body as import("stream/web").ReadableStream);
    await pipeline(nodeStream, fileStream);
    chmodSync(tempDest, 0o755);
    renameSync(tempDest, dest);
  } catch (err) {
    console.error("[update] Failed to auto-update yt-dlp:", (err as Error).message ?? err);
  }
}

export function buildYtdlpArgs(videoUrl: string): string[] {
  const args = [
    "--no-playlist",
    "-f",
    "bestaudio/best",
    "--js-runtimes",
    "node",
    "-g",
  ];
  args.push("--user-agent", YT_USER_AGENT);
  if (resolvedCookiePath && existsSync(resolvedCookiePath)) {
    args.push("--cookies", resolvedCookiePath);
  }
  args.push(videoUrl);
  return args;
}

function resolveYtdlpAudioUrl(ytdlpBin: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    const child = execFile(
      ytdlpBin,
      args,
      {
        timeout: 60000,
        windowsHide: true,
        maxBuffer: YTDLP_MAX_BUFFER,
        killSignal: "SIGKILL",
      },
      (err, stdout, stderr) => {
        if (err) {
          const detail = stderr?.trim() || err.message;
          console.error("[yt-dlp] URL extraction failed:", detail.slice(0, 200));
          resolve(null);
          return;
        }

        const firstUrl = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line.startsWith("http://") || line.startsWith("https://"));

        resolve(firstUrl ?? null);
      }
    );

    child.on("error", () => resolve(null));
  });
}

async function getMediaUrl(
  ytdlpBin: string,
  args: string[],
  videoId: string
): Promise<string | null> {
  const cached = getCachedStreamUrl(videoId);
  if (cached) return cached;

  const release = await acquireYtdlpSlot();
  try {
    const url = await dedupeUrlExtraction(videoId, () => resolveYtdlpAudioUrl(ytdlpBin, args));
    if (url) setCachedStreamUrl(videoId, url);
    return url;
  } finally {
    release();
  }
}

export async function streamViaYtdlp(
  req: Request,
  res: Response,
  ytdlpBin: string,
  args: string[],
  videoId: string
): Promise<boolean> {
  if (!tryAcquireStreamSlot()) {
    if (!res.headersSent) {
      res.status(503).json({ error: "Too many streams active. Try again shortly." });
    }
    return false;
  }

  const aborter = new AbortController();
  let nodeStream: Readable | null = null;
  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    aborter.abort();
    try {
      nodeStream?.destroy();
    } catch {
      /* ignore */
    }
    if (!res.writableEnded) {
      try {
        res.destroy();
      } catch {
        /* ignore */
      }
    }
  };

  req.on("close", cleanup);
  res.on("close", cleanup);

  try {
    const mediaUrl = await getMediaUrl(ytdlpBin, args, videoId);
    if (!mediaUrl) return false;

    const upstream = await fetch(mediaUrl, {
      signal: aborter.signal,
      redirect: "follow",
    });
    if (!upstream.ok || !upstream.body) return false;

    res.setHeader("Content-Type", upstream.headers.get("content-type") || "audio/webm");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Content-Type-Options", "nosniff");

    nodeStream = Readable.fromWeb(upstream.body as import("stream/web").ReadableStream);
    nodeStream.on("error", cleanup);

    await pipeline(nodeStream, res, { signal: aborter.signal });
    cleaned = true;
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== "ERR_STREAM_PREMATURE_CLOSE" && code !== "ABORT_ERR") {
      console.error("[stream] Upstream failed:", (err as Error).message?.slice(0, 120) ?? err);
    }
    cleanup();
    return false;
  } finally {
    releaseStreamSlot();
  }
}
