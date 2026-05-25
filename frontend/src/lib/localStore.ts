import type { Song, UserPlaylist } from "@/types";

const KEYS = {
  userName: "lumina_user_name",
  favorites: "lumina_favorites",
  playlists: "lumina_playlists",
} as const;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getUserName(): string | null {
  const name = localStorage.getItem(KEYS.userName);
  return name?.trim() || null;
}

export function setUserName(name: string) {
  localStorage.setItem(KEYS.userName, name.trim());
}

export function clearUserName() {
  localStorage.removeItem(KEYS.userName);
}

export function getFavorites(): Song[] {
  return readJson<Song[]>(KEYS.favorites, []);
}

export function saveFavorites(favorites: Song[]) {
  writeJson(KEYS.favorites, favorites);
}

export function getPlaylists(): UserPlaylist[] {
  return readJson<UserPlaylist[]>(KEYS.playlists, []);
}

export function savePlaylists(playlists: UserPlaylist[]) {
  writeJson(KEYS.playlists, playlists);
}

export function createPlaylist(name: string): UserPlaylist {
  const playlist: UserPlaylist = {
    id: crypto.randomUUID(),
    name: name.trim(),
    songs: [],
  };
  const playlists = getPlaylists();
  playlists.push(playlist);
  savePlaylists(playlists);
  return playlist;
}

export function deletePlaylist(playlistId: string) {
  savePlaylists(getPlaylists().filter((p) => p.id !== playlistId));
}

export function renamePlaylist(playlistId: string, name: string) {
  const playlists = getPlaylists().map((p) =>
    p.id === playlistId ? { ...p, name: name.trim() } : p
  );
  savePlaylists(playlists);
}

export function addSongToPlaylist(playlistId: string, song: Song) {
  const playlists = getPlaylists().map((p) => {
    if (p.id !== playlistId) return p;
    if (p.songs.some((s) => s.id === song.id)) return p;
    return { ...p, songs: [...p.songs, song] };
  });
  savePlaylists(playlists);
}

export function removeSongFromPlaylist(playlistId: string, songId: string) {
  const playlists = getPlaylists().map((p) =>
    p.id === playlistId ? { ...p, songs: p.songs.filter((s) => s.id !== songId) } : p
  );
  savePlaylists(playlists);
}
