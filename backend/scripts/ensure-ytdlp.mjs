import { chmodSync, createWriteStream, existsSync } from "fs";
import { get } from "https";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(backendRoot, "yt-dlp");
const YTDLP_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

if (process.env.SKIP_YTDLP_INSTALL === "1") {
  console.log("[ensure-ytdlp] Skipped (SKIP_YTDLP_INSTALL=1)");
  process.exit(0);
}

if (existsSync(dest)) {
  console.log("[ensure-ytdlp] Already installed at", dest);
  process.exit(0);
}

console.log("[ensure-ytdlp] Downloading yt-dlp to", dest);

await new Promise((resolve, reject) => {
  get(YTDLP_URL, (res) => {
    if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      get(res.headers.location, (res2) => {
        pipeline(res2, createWriteStream(dest)).then(resolve).catch(reject);
      }).on("error", reject);
      return;
    }
    if (res.statusCode !== 200) {
      reject(new Error(`yt-dlp download failed: HTTP ${res.statusCode}`));
      return;
    }
    pipeline(res, createWriteStream(dest)).then(resolve).catch(reject);
  }).on("error", reject);
});

chmodSync(dest, 0o755);
console.log("[ensure-ytdlp] Ready");
