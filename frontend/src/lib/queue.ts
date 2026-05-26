import type { Song } from "@/types";

export type RepeatMode = "off" | "all" | "one";

export function dedupeSongs(songs: Song[]): Song[] {
  const seen = new Set<string>();
  return songs.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

/** Fisher–Yates shuffle of queue indices. */
export function buildShuffledIndices(length: number, startIndex: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const withoutStart = indices.filter((i) => i !== startIndex);
  return [startIndex, ...withoutStart];
}

export function resolveNextIndex(
  currentIndex: number,
  queueLength: number,
  repeatMode: RepeatMode,
  shuffle: boolean,
  shuffledOrder: number[] | null
): number | null {
  if (queueLength <= 0) return null;
  if (repeatMode === "one") return currentIndex;

  if (shuffle && shuffledOrder && shuffledOrder.length === queueLength) {
    const pos = shuffledOrder.indexOf(currentIndex);
    if (pos >= 0 && pos < shuffledOrder.length - 1) return shuffledOrder[pos + 1];
    if (repeatMode === "all" && shuffledOrder.length > 0) return shuffledOrder[0];
    return null;
  }

  if (currentIndex < queueLength - 1) return currentIndex + 1;
  if (repeatMode === "all") return 0;
  return null;
}

export function resolvePreviousIndex(
  currentIndex: number,
  queueLength: number,
  shuffle: boolean,
  shuffledOrder: number[] | null
): number | null {
  if (queueLength <= 0) return null;

  if (shuffle && shuffledOrder && shuffledOrder.length === queueLength) {
    const pos = shuffledOrder.indexOf(currentIndex);
    if (pos > 0) return shuffledOrder[pos - 1];
    return null;
  }

  if (currentIndex > 0) return currentIndex - 1;
  return null;
}

/** Pick a random track from the pool, avoiding recent IDs. */
export function pickRandomFromPool(pool: Song[], avoidIds: Set<string>): Song | null {
  const candidates = pool.filter((s) => !avoidIds.has(s.id));
  if (candidates.length === 0) {
    const fallback = pool.filter((s) => s.id !== [...avoidIds][0]);
    if (fallback.length === 0) return pool[0] ?? null;
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}
