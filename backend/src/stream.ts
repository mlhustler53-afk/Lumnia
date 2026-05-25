import { spawn, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import type { Response, Request } from "express";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

const BOT_ERROR_RE = /not a bot|LOGIN_REQUIRED|Sign in to confirm/i;

export function buildYtdlpArgs(
  videoUrl: string,
  format: string,
  startSec: number,
  formatSectionTime: (s: number) => string
): string[] {
  const args = [
    "-f",
    format,
    "-o",
    "-",
    "--no-playlist",
    "--no-warnings",
    "--no-progress",
    "--extractor-args",
    "youtube:player_client=android_sdkless,web_embedded,tv_embedded",
    "--remote-components",
    "ejs:github",
  ];

  const cookies = process.env.YTDLP_COOKIES?.trim();
  if (cookies && existsSync(cookies)) {
    args.push("--cookies", cookies);
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
    let proc: ChildProcess | null = spawn(ytdlpBin, args, { windowsHide: true });

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

    proc.on("error", () => {
      kill();
      finish(false);
    });

    proc.stderr?.on("data", (data) => {
      const msg = data.toString();
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
        kill();
        finish(false);
      }
      void code;
    });

    req.on("close", kill);
    res.on("error", kill);
  });
}

interface PipedAudioStream {
  url: string;
  mimeType?: string;
  bitrate?: number;
}

interface PipedStreamsResponse {
  audioStreams?: PipedAudioStream[];
}

const DEFAULT_PIPED_API = "https://pipedapi.adminforge.de";

export async function streamViaPiped(
  req: Request,
  res: Response,
  videoId: string
): Promise<boolean> {
  const apiBase = (process.env.PIPED_API_URL || DEFAULT_PIPED_API).replace(/\/$/, "");

  try {
    const metaRes = await fetch(`${apiBase}/streams/${videoId}`, {
      headers: { "User-Agent": "LuminaMusic/1.0" },
      signal: AbortSignal.timeout(15000),
    });

    if (!metaRes.ok) return false;

    const data = (await metaRes.json()) as PipedStreamsResponse;
    const audio = [...(data.audioStreams ?? [])].sort(
      (a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0)
    )[0];

    if (!audio?.url) return false;

    const upstream = await fetch(audio.url, {
      headers: { "User-Agent": "LuminaMusic/1.0" },
      signal: AbortSignal.timeout(120000),
    });

    if (!upstream.ok || !upstream.body) return false;

    res.setHeader("Content-Type", audio.mimeType || "audio/webm");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const nodeStream = Readable.fromWeb(upstream.body as import("stream/web").ReadableStream);
    await pipeline(nodeStream, res);
    return true;
  } catch (err) {
    console.warn("[piped fallback]", err);
    return false;
  }
}
