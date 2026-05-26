import type { Song } from "@/types";

const STORAGE_KEY = "lumina_listening_history";
const MAX_RECENT = 50;

export interface SongPlayStats {
  songId: string;
  title: string;
  author: string;
  thumbnail: string;
  duration?: string;
  url?: string;
  playCount: number;
  totalListenSeconds: number;
  skips: number;
  lastPlayedAt: number;
}

interface ListeningHistoryStore {
  songs: Record<string, SongPlayStats>;
  recentIds: string[];
}

function readStore(): ListeningHistoryStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { songs: {}, recentIds: [] };
    const parsed = JSON.parse(raw) as ListeningHistoryStore;
    return {
      songs: parsed.songs ?? {},
      recentIds: Array.isArray(parsed.recentIds) ? parsed.recentIds : [],
    };
  } catch {
    return { songs: {}, recentIds: [] };
  }
}

function writeStore(store: ListeningHistoryStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function songToStats(song: Song): Omit<SongPlayStats, "playCount" | "totalListenSeconds" | "skips" | "lastPlayedAt"> {
  return {
    songId: song.id,
    title: song.title,
    author: song.author,
    thumbnail: song.thumbnail,
    duration: song.duration,
    url: song.url,
  };
}

function statsToSong(stats: SongPlayStats): Song {
  return {
    id: stats.songId,
    title: stats.title,
    author: stats.author,
    thumbnail: stats.thumbnail,
    duration: stats.duration,
    url: stats.url,
  };
}

/** Called when user starts playing a track. */
export function recordPlayStart(song: Song) {
  const store = readStore();
  const existing = store.songs[song.id];
  const base = songToStats(song);

  store.songs[song.id] = {
    ...base,
    playCount: (existing?.playCount ?? 0) + 1,
    totalListenSeconds: existing?.totalListenSeconds ?? 0,
    skips: existing?.skips ?? 0,
    lastPlayedAt: Date.now(),
  };

  store.recentIds = [song.id, ...store.recentIds.filter((id) => id !== song.id)].slice(0, MAX_RECENT);
  writeStore(store);
}

/** Accumulate seconds listened for the current track (call periodically). */
export function recordListenSeconds(songId: string, seconds: number) {
  if (seconds <= 0) return;
  const store = readStore();
  const entry = store.songs[songId];
  if (!entry) return;
  entry.totalListenSeconds += seconds;
  entry.lastPlayedAt = Date.now();
  writeStore(store);
}

/** Called when user skips away before the track ends. */
export function recordSkip(song: Song) {
  const store = readStore();
  const existing = store.songs[song.id];
  if (!existing) {
    store.songs[song.id] = {
      ...songToStats(song),
      playCount: 0,
      totalListenSeconds: 0,
      skips: 1,
      lastPlayedAt: Date.now(),
    };
  } else {
    existing.skips += 1;
    existing.lastPlayedAt = Date.now();
  }
  writeStore(store);
}

export function getTopSongs(limit = 12): Song[] {
  const { songs } = readStore();
  return Object.values(songs)
    .sort((a, b) => b.playCount - a.playCount || b.totalListenSeconds - a.totalListenSeconds)
    .slice(0, limit)
    .map(statsToSong);
}

export function getTopArtists(limit = 8): { artist: string; playCount: number; listenSeconds: number }[] {
  const { songs } = readStore();
  const byArtist = new Map<string, { playCount: number; listenSeconds: number }>();

  for (const entry of Object.values(songs)) {
    const key = entry.author.trim() || "Unknown";
    const cur = byArtist.get(key) ?? { playCount: 0, listenSeconds: 0 };
    byArtist.set(key, {
      playCount: cur.playCount + entry.playCount,
      listenSeconds: cur.listenSeconds + entry.totalListenSeconds,
    });
  }

  return [...byArtist.entries()]
    .map(([artist, stats]) => ({ artist, ...stats }))
    .sort((a, b) => b.playCount - a.playCount || b.listenSeconds - a.listenSeconds)
    .slice(0, limit);
}

export function getRecentlyPlayed(limit = 12): Song[] {
  const store = readStore();
  const result: Song[] = [];
  for (const id of store.recentIds) {
    const stats = store.songs[id];
    if (stats) result.push(statsToSong(stats));
    if (result.length >= limit) break;
  }
  return result;
}

export function getFavoriteSongsFromHistory(limit = 12): Song[] {
  const { songs } = readStore();
  return Object.values(songs)
    .filter((s) => s.totalListenSeconds >= 30)
    .sort((a, b) => b.totalListenSeconds - a.totalListenSeconds)
    .slice(0, limit)
    .map(statsToSong);
}

export function hasListeningHistory(): boolean {
  const store = readStore();
  return Object.keys(store.songs).length > 0;
}
