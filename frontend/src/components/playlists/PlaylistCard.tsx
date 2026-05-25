import { ListMusic, Play } from "lucide-react";
import type { UserPlaylist } from "@/types";

interface PlaylistCardProps {
  playlist: UserPlaylist;
  onClick: () => void;
  onPlay?: (e: React.MouseEvent) => void;
}

export function PlaylistCard({ playlist, onClick, onPlay }: PlaylistCardProps) {
  const cover = playlist.songs[0]?.thumbnail;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="group glass cursor-pointer rounded-3xl p-4 transition-all hover:bg-white/[0.08]"
    >
      <div className="relative mb-4 aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-violet-900/50 to-fuchsia-900/30">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover opacity-90" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ListMusic className="h-12 w-12 text-violet-400/50" />
          </div>
        )}
        {onPlay && playlist.songs.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(e);
            }}
            className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-violet-500 opacity-0 shadow-lg transition-all group-hover:opacity-100 hover:scale-105"
            title="Play playlist"
          >
            <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
          </button>
        )}
      </div>
      <h3 className="truncate font-bold text-sm">{playlist.name}</h3>
      <p className="text-xs text-white/40">
        {playlist.songs.length} {playlist.songs.length === 1 ? "track" : "tracks"}
      </p>
    </div>
  );
}
