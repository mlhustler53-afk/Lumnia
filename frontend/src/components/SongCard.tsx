import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, Heart, Plus, ListMusic, Check } from "lucide-react";
import type { Song } from "@/types";
import { useMusic } from "@/context/MusicContext";

interface SongCardProps {
  song: Song;
  songList: Song[];
  playlistId?: string;
  playlistSongs?: Song[];
}

export const SongCard = React.memo(function SongCard({
  song,
  songList,
  playlistId,
  playlistSongs,
}: SongCardProps) {
  const { playSong, currentSong, isPlaying, toggleFavorite, favorites, playlists, addSongToPlaylist, removeSongFromPlaylist } =
    useMusic();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = currentSong?.id === song.id;
  const isFav = favorites.some((f) => f.id === song.id);
  const inCurrentPlaylist = playlistId && playlistSongs?.some((s) => s.id === song.id);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`group glass cursor-pointer rounded-[32px] p-5 transition-all hover:bg-white/[0.08] ${
        isActive ? "ring-2 ring-indigo-500 bg-white/[0.08]" : ""
      }`}
      onClick={() => playSong(song, songList)}
    >
      <div className="relative mb-5 aspect-square overflow-hidden rounded-[24px] shadow-2xl album-glow">
        <img
          src={song.thumbnail}
          alt={song.title}
          className="h-full w-full object-cover transition-transform duration-[1.5s] group-hover:scale-110"
        />
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-[2px] transition-all duration-500 group-hover:opacity-100 ${
            isActive && isPlaying ? "opacity-100 backdrop-blur-[4px]" : ""
          }`}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-white/20 shadow-2xl backdrop-blur-md transition-all duration-500 group-hover:scale-100 scale-75">
            {isActive && isPlaying ? (
              <Pause className="fill-white text-white" />
            ) : (
              <Play className="ml-1 fill-white text-white" />
            )}
          </div>
        </div>
      </div>
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0 overflow-hidden">
          <h3 className="mb-1 truncate text-sm font-bold leading-tight tracking-tight md:text-base">
            {song.title}
          </h3>
          <p className="truncate font-serif text-xs italic text-indigo-400 opacity-70 md:text-sm">
            {song.author}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="rounded-lg p-1 text-white/25 transition-all hover:scale-110 hover:text-violet-300"
              title="Add to playlist"
            >
              <Plus className="h-5 w-5" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.96 }}
                  className="absolute bottom-full right-0 z-50 mb-2 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#121218] py-1 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/35">
                    Add to playlist
                  </p>
                  {playlists.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-white/40">Create a playlist first</p>
                  ) : (
                    playlists.map((pl) => {
                      const hasSong = pl.songs.some((s) => s.id === song.id);
                      return (
                        <button
                          key={pl.id}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (hasSong) {
                              await removeSongFromPlaylist(pl.id, song.id, pl.songs);
                            } else {
                              await addSongToPlaylist(pl.id, song, pl.songs);
                            }
                            setMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
                        >
                          <ListMusic className="h-4 w-4 shrink-0 text-violet-400" />
                          <span className="flex-1 truncate">{pl.name}</span>
                          {hasSong && <Check className="h-4 w-4 shrink-0 text-violet-400" />}
                        </button>
                      );
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {playlistId && playlistSongs && inCurrentPlaylist && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                await removeSongFromPlaylist(playlistId, song.id, playlistSongs);
              }}
              className="rounded-lg p-1 text-xs text-red-400/70 hover:text-red-400"
              title="Remove from playlist"
            >
              ×
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(song);
            }}
            className="-mr-1 p-1 text-white/20 transition-all hover:scale-110 hover:text-indigo-400"
          >
            <Heart
              className={`h-5 w-5 ${isFav ? "fill-indigo-400 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]" : ""}`}
            />
          </button>
        </div>
      </div>
    </motion.div>
  );
});
