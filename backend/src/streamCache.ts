interface StreamCacheEntry {
  url: string;
  expiresAt: number;
}

const streamCache = new Map<string, StreamCacheEntry>();

/** Default TTL: 45 minutes (within 30–60 min target). */
const CACHE_TTL_MS = 45 * 60 * 1000;

export function getCachedStreamUrl(videoId: string): string | null {
  const entry = streamCache.get(videoId);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    streamCache.delete(videoId);
    return null;
  }
  return entry.url;
}

export function setCachedStreamUrl(videoId: string, url: string): void {
  streamCache.set(videoId, {
    url,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}
