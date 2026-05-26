import { Play, Pause, Heart, MoreHorizontal } from "lucide-react";
import type { Song } from "@/types";
import { useMusic } from "@/context/MusicContext";
import { cn } from "@/lib/utils";

interface PlaylistTrackRowProps {
  song: Song;
  index: number;
  songList: Song[];
  playlistId: string;
}

export function PlaylistTrackRow({ song, index, songList, playlistId }: PlaylistTrackRowProps) {
  const {
    playSong,
    currentSong,
    isPlaying,
    toggleFavorite,
    favorites,
    removeSongFromPlaylist,
  } = useMusic();

  const isActive = currentSong?.id === song.id;
  const isFav = favorites.some((f) => f.id === song.id);

  return (
    <button
      type="button"
      onClick={() => playSong(song, songList)}
      className={cn(
        "group flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition-colors",
        isActive ? "bg-violet-500/15" : "hover:bg-white/[0.06]"
      )}
    >
      <span className="w-6 shrink-0 text-center text-sm tabular-nums text-white/35 group-hover:hidden">
        {isActive && isPlaying ? (
          <span className="inline-flex h-4 items-end justify-center gap-0.5">
            <span className="eq-bar h-3 w-0.5" />
            <span className="eq-bar h-3 w-0.5" />
            <span className="eq-bar h-3 w-0.5" />
          </span>
        ) : (
          index + 1
        )}
      </span>
      <span className="hidden w-6 shrink-0 group-hover:inline-flex group-hover:justify-center">
        {isActive && isPlaying ? (
          <Pause className="h-4 w-4 text-violet-300" />
        ) : (
          <Play className="h-4 w-4 text-white" />
        )}
      </span>

      <img
        src={song.thumbnail}
        alt=""
        loading="lazy"
        className="h-12 w-12 shrink-0 rounded-lg object-cover"
      />

      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-medium", isActive ? "text-violet-300" : "text-white")}>
          {song.title}
        </p>
        <p className="truncate text-sm text-white/45">{song.author}</p>
      </div>

      <span className="hidden shrink-0 text-sm text-white/40 sm:block">{song.duration ?? "—"}</span>

      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(song);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.stopPropagation();
            toggleFavorite(song);
          }
        }}
        className="shrink-0 rounded-lg p-2 text-white/30 hover:text-pink-400"
      >
        <Heart className={cn("h-4 w-4", isFav && "fill-pink-500 text-pink-500")} />
      </span>

      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          void removeSongFromPlaylist(playlistId, song.id, songList);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.stopPropagation();
            void removeSongFromPlaylist(playlistId, song.id, songList);
          }
        }}
        className="shrink-0 rounded-lg p-2 text-white/25 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
        title="Remove from playlist"
      >
        <MoreHorizontal className="h-4 w-4" />
      </span>
    </button>
  );
}
