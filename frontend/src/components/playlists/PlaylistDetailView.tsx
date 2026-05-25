import { ArrowLeft, Play, Trash2, ListMusic } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserPlaylist } from "@/types";
import { SongCard } from "@/components/SongCard";

interface PlaylistDetailViewProps {
  playlist: UserPlaylist;
  onBack: () => void;
  onPlayAll: () => void;
  onDelete: () => void;
}

export function PlaylistDetailView({
  playlist,
  onBack,
  onPlayAll,
  onDelete,
}: PlaylistDetailViewProps) {
  const cover = playlist.songs[0]?.thumbnail;

  return (
    <div className="space-y-10">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex items-end gap-6">
          <div className="h-40 w-40 shrink-0 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-800/50 to-fuchsia-900/40 shadow-2xl album-glow">
            {cover ? (
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <ListMusic className="h-16 w-16 text-violet-400/40" />
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-violet-400">Playlist</p>
            <h1 className="mt-1 text-4xl font-bold tracking-tight">{playlist.name}</h1>
            <p className="mt-2 text-white/45">
              {playlist.songs.length} {playlist.songs.length === 1 ? "song" : "songs"}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={onPlayAll}
            disabled={playlist.songs.length === 0}
            className="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-8"
          >
            <Play className="ml-0.5 h-4 w-4" />
            Play all
          </Button>
          <Button
            variant="outline"
            onClick={onDelete}
            className="rounded-full border-red-500/30 text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {playlist.songs.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {playlist.songs.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              songList={playlist.songs}
              playlistId={playlist.id}
              playlistSongs={playlist.songs}
            />
          ))}
        </div>
      ) : (
        <div className="glass rounded-3xl border border-dashed border-white/10 py-20 text-center">
          <p className="text-white/50">This playlist is empty</p>
          <p className="mt-2 text-sm text-white/30">
            Search for music and use the + button to add tracks here
          </p>
        </div>
      )}
    </div>
  );
}
