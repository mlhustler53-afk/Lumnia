import { createContext, useContext } from "react";
import type { Song, UserPlaylist, LuminaUser } from "@/types";

export interface MusicContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  playSong: (song: Song, customQueue?: Song[]) => void;
  playPlaylist: (playlist: UserPlaylist) => void;
  togglePlay: () => void;
  favorites: Song[];
  toggleFavorite: (song: Song) => void;
  playlists: UserPlaylist[];
  createPlaylist: (name: string) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  addSongToPlaylist: (playlistId: string, song: Song, existingSongs: Song[]) => Promise<void>;
  removeSongFromPlaylist: (playlistId: string, songId: string, existingSongs: Song[]) => Promise<void>;
  user: LuminaUser;
  error: string | null;
  clearError: () => void;
  queue: Song[];
  skipToNext: () => void;
  skipToPrevious: () => void;
  lyrics: string;
  lyricsLoading: boolean;
  showLyrics: boolean;
  setShowLyrics: (show: boolean) => void;
}

export const MusicContext = createContext<MusicContextType | null>(null);

export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) throw new Error("useMusic must be used within MusicProvider");
  return context;
}
