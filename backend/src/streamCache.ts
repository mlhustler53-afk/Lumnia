interface StreamCacheEntry {
  url: string;
  expiresAt: number;
}

/** URL strings only — never audio buffers. Bounded LRU. */
const MAX_ENTRIES = Math.max(10, parseInt(process.env.STREAM_URL_CACHE_MAX || "50", 10));
const CACHE_TTL_MS = Math.max(60_000, parseInt(process.env.STREAM_URL_CACHE_TTL_MS || String(45 * 60 * 1000), 10));

const streamCache = new Map<string, StreamCacheEntry>();

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of streamCache) {
    if (now >= entry.expiresAt) streamCache.delete(key);
  }
}

function evictOldest(): void {
  const first = streamCache.keys().next().value;
  if (first) streamCache.delete(first);
}

export function getCachedStreamUrl(videoId: string): string | null {
  const entry = streamCache.get(videoId);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    streamCache.delete(videoId);
    return null;
  }
  streamCache.delete(videoId);
  streamCache.set(videoId, entry);
  return entry.url;
}

export function setCachedStreamUrl(videoId: string, url: string): void {
  evictExpired();
  while (streamCache.size >= MAX_ENTRIES) evictOldest();
  streamCache.set(videoId, {
    url,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function clearStreamUrlCache(): void {
  streamCache.clear();
}

export function getStreamCacheStats(): { size: number; maxEntries: number } {
  return { size: streamCache.size, maxEntries: MAX_ENTRIES };
}
