#!/usr/bin/env bash
set -euo pipefail

# ── 1. Download yt-dlp binary ───────────────────────────────────────────────
echo "[build] Downloading yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp
chmod a+rx yt-dlp
echo "[build] yt-dlp ready: $(./yt-dlp --version)"

# ── 2. Cookie file resolution ────────────────────────────────────────────────
# Priority 1: Render Secret File — uploaded via Dashboard → Secret Files
#             Path: /opt/render/project/src/youtube-cookies.txt
#             (The app detects this automatically at runtime — no action needed here.)
RENDER_SECRET_COOKIES="/opt/render/project/src/youtube-cookies.txt"
if [ -f "$RENDER_SECRET_COOKIES" ]; then
  echo "[build] ✅ Render secret cookie file found at $RENDER_SECRET_COOKIES"

# Priority 2: YT_COOKIES_BASE64 env var → decode to cookies.txt in cwd
elif [ -n "${YT_COOKIES_BASE64:-}" ]; then
  echo "[build] Decoding YT_COOKIES_BASE64 → cookies.txt ..."
  echo "$YT_COOKIES_BASE64" | base64 -d > cookies.txt
  echo "[build] ✅ cookies.txt written ($(wc -c < cookies.txt) bytes)"

else
  echo "[build] ⚠️  No cookie file found. Set the 'youtube-cookies.txt' Secret File in Render"
  echo "         or set the YT_COOKIES_BASE64 environment variable."
  echo "         yt-dlp may be bot-blocked without cookies."
fi
