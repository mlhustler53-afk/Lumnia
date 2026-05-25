import { motion } from "motion/react";
import { Sparkles, Play, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RecommendationSection, Song, UserPlaylist } from "@/types";
import { SongCard } from "@/components/SongCard";
import { PlaylistCard } from "@/components/playlists/PlaylistCard";
import { ListeningTimePanel } from "@/components/ListeningTimePanel";
import { Logo } from "@/components/Logo";

interface HomeViewProps {
  userName: string;
  sessionId: string;
  liveListeningSeconds: number;
  sections: RecommendationSection[];
  playlists: UserPlaylist[];
  homeMix: Song[];
  loading: boolean;
  onRefresh: () => void;
  onPlayMix: () => void;
  onOpenPlaylist: (playlist: UserPlaylist) => void;
  onPlayPlaylist: (playlist: UserPlaylist) => void;
  onCreatePlaylist: () => void;
}

export function HomeView({
  userName,
  sessionId,
  liveListeningSeconds,
  sections,
  playlists,
  homeMix,
  loading,
  onRefresh,
  onPlayMix,
  onOpenPlaylist,
  onPlayPlaylist,
  onCreatePlaylist,
}: HomeViewProps) {
  const greeting = getGreeting();

  return (
    <div className="space-y-14">
      <section className="relative overflow-hidden rounded-[40px] border border-violet-500/20 bg-gradient-to-br from-violet-950/80 via-black/60 to-fuchsia-950/50 p-8 md:p-12">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl space-y-4">
            <div className="flex items-center gap-3">
              <Logo size="sm" />
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-violet-300/80">
                <Sparkles className="h-4 w-4" />
                Lumina · For you
              </p>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
              {greeting}, {userName.split(" ")[0]}
            </h1>
            <p className="font-serif italic text-lg text-white/50">
              {homeMix.length > 0
                ? `Your daily mix has ${homeMix.length} hand-picked tracks across ${sections.filter((s) => s.songs.length > 0).length} moods.`
                : "Curating your recommendations…"}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                onClick={onPlayMix}
                disabled={homeMix.length === 0 || loading}
                className="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-8 shadow-lg shadow-violet-500/30 hover:from-violet-600 hover:to-fuchsia-600"
              >
                <Play className="ml-0.5 h-4 w-4" />
                Play Daily Mix
              </Button>
              <Button
                variant="outline"
                onClick={onRefresh}
                disabled={loading}
                className="rounded-full border-violet-500/30 bg-black/30 text-violet-200 hover:bg-violet-500/10"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
          </div>
          {homeMix.length > 0 && (
            <div className="flex -space-x-3">
              {homeMix.slice(0, 4).map((song) => (
                <img
                  key={song.id}
                  src={song.thumbnail}
                  alt=""
                  className="h-16 w-16 rounded-2xl border-2 border-black/50 object-cover shadow-xl md:h-20 md:w-20"
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <ListeningTimePanel
        currentUserName={userName}
        sessionId={sessionId}
        liveSeconds={liveListeningSeconds}
      />

      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Your Playlists</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={onCreatePlaylist}
            className="rounded-full border-violet-500/30 text-violet-200"
          >
            + New playlist
          </Button>
        </div>
        {playlists.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {playlists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                onClick={() => onOpenPlaylist(playlist)}
                onPlay={() => onPlayPlaylist(playlist)}
              />
            ))}
          </div>
        ) : (
          <button
            onClick={onCreatePlaylist}
            className="glass w-full rounded-3xl border border-dashed border-violet-500/30 p-10 text-center transition-colors hover:border-violet-500/50 hover:bg-white/[0.04]"
          >
            <p className="font-medium text-white/70">Create your first playlist</p>
            <p className="mt-1 text-sm text-white/40">Save tracks from search and play them anytime</p>
          </button>
        )}
      </section>

      {loading && sections.every((s) => s.songs.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400/60" />
          <p className="mt-4 text-white/40">Loading recommendations…</p>
        </div>
      ) : (
        sections.map((section) =>
          section.songs.length > 0 ? (
            <section key={section.id}>
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{section.title}</h2>
                  <p className="mt-1 text-sm text-white/45">{section.subtitle}</p>
                </div>
                <span
                  className={`hidden h-1 w-16 shrink-0 rounded-full bg-gradient-to-r ${section.accent} md:block`}
                />
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {section.songs.slice(0, 8).map((song) => (
                  <SongCard key={`${section.id}-${song.id}`} song={song} songList={section.songs} />
                ))}
              </div>
            </section>
          ) : null
        )
      )}
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
