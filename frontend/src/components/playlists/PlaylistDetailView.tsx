import { ArrowLeft, Play, Trash2, ListMusic } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserPlaylist } from "@/types";
import { PlaylistTrackRow } from "@/components/playlists/PlaylistTrackRow";
import { SongCardSkeletonGrid } from "@/components/skeletons/Skeletons";

interface PlaylistDetailViewProps {
  playlist: UserPlaylist;
  onBack: () => void;
  onPlayAll: () => void;
  onDelete: () => void;
  loading?: boolean;
}

export function PlaylistDetailView({
  playlist,
  onBack,
  onPlayAll,
  onDelete,
  loading = false,
}: PlaylistDetailViewProps) {
  const cover = playlist.songs[0]?.thumbnail;

  return (
    <div className="space-y-8 pb-8">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Playlists
      </button>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
          <div className="mx-auto h-36 w-36 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-800/50 to-fuchsia-900/40 shadow-2xl album-glow sm:mx-0 sm:h-40 sm:w-40 sm:rounded-3xl">
            {cover ? (
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <ListMusic className="h-16 w-16 text-violet-400/40" />
              </div>
            )}
          </div>
          <div className="text-center sm:text-left">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-400">Playlist</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{playlist.name}</h1>
            <p className="mt-2 text-white/45">
              {playlist.songs.length} {playlist.songs.length === 1 ? "song" : "songs"}
            </p>
          </div>
        </div>
        <div className="flex justify-center gap-3 sm:justify-end">
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
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <SongCardSkeletonGrid count={6} />
      ) : playlist.songs.length > 0 ? (
        <div className="glass overflow-hidden rounded-2xl border border-white/5">
          <div className="hidden border-b border-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/30 sm:grid sm:grid-cols-[auto_1fr_auto] sm:gap-4">
            <span className="w-10">#</span>
            <span>Title</span>
            <span className="pr-16 text-right">Duration</span>
          </div>
          <ul className="divide-y divide-white/5">
            {playlist.songs.map((song, i) => (
              <li key={song.id}>
                <PlaylistTrackRow
                  song={song}
                  index={i}
                  songList={playlist.songs}
                  playlistId={playlist.id}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="glass rounded-3xl border border-dashed border-white/10 py-16 text-center px-6">
          <ListMusic className="mx-auto mb-4 h-12 w-12 text-violet-400/30" />
          <p className="font-medium text-white/60">This playlist is empty</p>
          <p className="mt-2 text-sm text-white/35">
            Search for music and tap + on any track to add it here
          </p>
        </div>
      )}
    </div>
  );
}
