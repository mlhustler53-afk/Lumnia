/** Lightweight LRU + TTL cache for search JSON only (never audio). */

export interface SearchResultItem {
  id: string;
  title: string;
  thumbnail: string;
  author: string;
  duration: string;
  url: string;
}

interface CacheEntry {
  data: SearchResultItem[];
  expiresAt: number;
}

const MAX_ENTRIES = Math.max(10, parseInt(process.env.SEARCH_CACHE_MAX || "40", 10));
const TTL_MS = Math.max(60_000, parseInt(process.env.SEARCH_CACHE_TTL_MS || "600000", 10));

const cache = new Map<string, CacheEntry>();

function normalizeKey(query: string): string {
  return query.trim().toLowerCase().slice(0, 120);
}

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now >= entry.expiresAt) cache.delete(key);
  }
}

function evictOldest(): void {
  const first = cache.keys().next().value;
  if (first) cache.delete(first);
}

export function getCachedSearch(query: string): SearchResultItem[] | null {
  const key = normalizeKey(query);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.data;
}

export function setCachedSearch(query: string, data: SearchResultItem[]): void {
  evictExpired();
  while (cache.size >= MAX_ENTRIES) evictOldest();
  const key = normalizeKey(query);
  cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

export function clearSearchCache(): void {
  cache.clear();
}

export function getSearchCacheStats(): { size: number; maxEntries: number; ttlMs: number } {
  return { size: cache.size, maxEntries: MAX_ENTRIES, ttlMs: TTL_MS };
}
