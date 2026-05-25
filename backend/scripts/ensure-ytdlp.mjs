import { chmodSync, createWriteStream, existsSync, statSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const dest = join(backendRoot, isWin ? "yt-dlp.exe" : "yt-dlp");
const YTDLP_URL = isWin
  ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
  : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

if (process.env.SKIP_YTDLP_INSTALL === "1") {
  console.log("[ensure-ytdlp] Skipped (SKIP_YTDLP_INSTALL=1)");
  process.exit(0);
}

if (existsSync(dest)) {
  const stats = statSync(dest);
  if (stats.size > 0) {
    console.log("[ensure-ytdlp] Already installed at", dest);
    process.exit(0);
  } else {
    console.log("[ensure-ytdlp] Found empty yt-dlp file, removing and re-downloading...");
    unlinkSync(dest);
  }
}

console.log(`[ensure-ytdlp] Downloading yt-dlp for ${process.platform} to ${dest}`);
console.log(`[ensure-ytdlp] URL: ${YTDLP_URL}`);

try {
  // Use Node 22's built-in fetch — handles GitHub's 302 redirects automatically
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

  const fileStream = createWriteStream(dest);
  const nodeStream = Readable.fromWeb(res.body);
  await pipeline(nodeStream, fileStream);

  chmodSync(dest, 0o755);

  const finalStats = statSync(dest);
  console.log(`[ensure-ytdlp] Ready (${(finalStats.size / 1024 / 1024).toFixed(1)} MB)`);
} catch (err) {
  console.error("[ensure-ytdlp] Failed to download:", err);
  // Clean up partial downloads
  try { if (existsSync(dest)) unlinkSync(dest); } catch { /* ignore */ }
  process.exit(1);
}
