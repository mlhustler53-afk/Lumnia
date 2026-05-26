import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search as SearchIcon,
  Heart,
  AlertCircle,
  X,
  ListMusic,
  Home,
  Clock,
  Github,
} from "lucide-react";
import { Song, UserPlaylist, RecommendationSection, LuminaUser } from "./types";
import { BGPattern } from "@/components/BGPattern";
import { AmbientCanvas } from "@/components/AmbientCanvas";
import { PlayerBar } from "@/components/player/PlayerBar";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { AnnouncementScreen } from "@/components/AnnouncementScreen";
import { acknowledgeAnnouncement, shouldShowAnnouncement } from "@/lib/announcement";
import { MusicContext } from "@/context/MusicContext";
import { HomeView } from "@/components/home/HomeView";
import { PlaylistDetailView } from "@/components/playlists/PlaylistDetailView";
import { CreatePlaylistDialog } from "@/components/playlists/CreatePlaylistDialog";
import { SongCard } from "@/components/SongCard";
import {
  getUserName,
  setUserName,
  clearUserName,
  getFavorites,
  saveFavorites,
  getPlaylists,
  getPlaylistById,
  createPlaylist as createPlaylistLocal,
  deletePlaylist as deletePlaylistLocal,
  addSongToPlaylist as addSongLocal,
  removeSongFromPlaylist as removeSongLocal,
} from "@/lib/localStore";
import {
  buildShuffledIndices,
  dedupeSongs,
  pickRandomFromPool,
  resolveNextIndex,
  resolvePreviousIndex,
  type RepeatMode,
} from "@/lib/queue";
import { getRecentlyPlayed } from "@/lib/listeningHistory";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { fetchHomeRecommendations, buildHomeMix } from "@/lib/recommendations";
import { recordPlayStart, recordSkip, recordListenSeconds } from "@/lib/listeningHistory";
import { SearchResultsSkeleton } from "@/components/skeletons/Skeletons";
import {
  getSessionId,
  tickListeningSecond,
  takePendingListeningSeconds,
  syncListeningTime,
  getPendingListeningSeconds,
} from "@/lib/listeningTime";
import { ListeningTimePanel } from "@/components/ListeningTimePanel";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { getApiBase } from "@/lib/api";

const API_BASE = getApiBase();

type AppView = "home" | "favorites" | "playlists" | "playlist-detail" | "listening";

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-28 left-1/2 z-[100] flex max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl border border-red-500/20 glass px-6 py-3 shadow-2xl"
    >
      <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
      <p className="text-sm font-medium text-white/80">{message}</p>
      <button onClick={onClose} className="ml-2 shrink-0 text-lg leading-none text-white/40 hover:text-white">
        &times;
      </button>
    </motion.div>
  );
}

export default function App() {
  const [showAnnouncement, setShowAnnouncement] = useState(() => shouldShowAnnouncement());
  const [user, setUser] = useState<LuminaUser | null>(() => {
    const name = getUserName();
    return name ? { name } : null;
  });
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [favorites, setFavorites] = useState<Song[]>(() => getFavorites());
  const [playlists, setPlaylists] = useState<UserPlaylist[]>(() => getPlaylists());
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationSection[]>([]);
  const [homeMix, setHomeMix] = useState<Song[]>([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const lastHistorySongIdRef = useRef<string | null>(null);
  const lastHistoryTickRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(-1);
  const [lyrics, setLyrics] = useState("");
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [activeView, setActiveView] = useState<AppView>("home");
  const [selectedPlaylist, setSelectedPlaylist] = useState<UserPlaylist | null>(null);
  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);
  const [, setListenTick] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");

  const playHistoryRef = useRef<Song[]>([]);
  const shuffledOrderRef = useRef<number[] | null>(null);
  const recentPlayedIdsRef = useRef<string[]>([]);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 400);

  const clearError = useCallback(() => setError(null), []);

  const refreshPlaylists = useCallback(() => {
    setPlaylists(getPlaylists());
  }, []);

  const loadRecommendations = useCallback(async () => {
    setRecsLoading(true);
    try {
      const sections = await fetchHomeRecommendations(API_BASE);
      setRecommendations(sections);
      setHomeMix(buildHomeMix(sections));
    } catch {
      setError("Could not load recommendations. Check your connection.");
    } finally {
      setRecsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadRecommendations();
  }, [user, loadRecommendations]);

  useEffect(() => {
    if (!selectedPlaylist) return;
    const updated = getPlaylistById(selectedPlaylist.id);
    if (updated) setSelectedPlaylist(updated);
  }, [playlists, selectedPlaylist?.id]);

  const shufflePool = useMemo(() => {
    return dedupeSongs([
      ...queue,
      ...homeMix,
      ...recommendations.flatMap((s) => s.songs),
      ...favorites,
      ...playlists.flatMap((p) => p.songs),
      ...getRecentlyPlayed(24),
    ]);
  }, [queue, homeMix, recommendations, favorites, playlists]);

  const openPlaylist = useCallback((playlistId: string) => {
    const pl = getPlaylistById(playlistId);
    if (!pl) return;
    setSelectedPlaylist(pl);
    setActiveView("playlist-detail");
    setSearchResults([]);
  }, []);

  const cycleRepeatMode = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === "off") return "all";
      if (prev === "all") return "one";
      return "off";
    });
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      setError((e as CustomEvent).detail || "Playback error");
    };
    window.addEventListener("lumina-error", handler);
    return () => window.removeEventListener("lumina-error", handler);
  }, []);

  const flushListeningTime = useCallback(async () => {
    if (!user?.name) return;
    const seconds = takePendingListeningSeconds();
    if (seconds <= 0) return;
    await syncListeningTime(API_BASE, getSessionId(), user.name, seconds);
    setListenTick((n) => n + 1);
  }, [user?.name]);

  useEffect(() => {
    if (!isPlaying || !user) return;
    const interval = setInterval(() => {
      tickListeningSecond();
      setListenTick((n) => n + 1);
      const songId = lastHistorySongIdRef.current;
      if (songId) {
        const now = Date.now();
        const elapsed = Math.floor((now - lastHistoryTickRef.current) / 1000);
        if (elapsed > 0) {
          recordListenSeconds(songId, elapsed);
          lastHistoryTickRef.current = now;
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, user]);

  useEffect(() => {
    if (!user) return;
    void flushListeningTime();
    const interval = setInterval(() => void flushListeningTime(), 30_000);
    return () => {
      void flushListeningTime();
    };
  }, [user, flushListeningTime]);

  useEffect(() => {
    if (isPlaying || !user) return;
    void flushListeningTime();
  }, [isPlaying, user, flushListeningTime]);

  const handleEnterName = (name: string) => {
    setUserName(name);
    setUser({ name });
  };

  const handleChangeName = () => {
    clearUserName();
    setUser(null);
  };

  const runSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Search failed");
      setSearchResults(await res.json());
    } catch {
      setError("Search failed. Make sure the backend is running.");
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setActiveView("home");
    await runSearch(searchQuery);
  };

  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      if (!searchQuery.trim()) setSearchResults([]);
      return;
    }
    if (debouncedSearchQuery.trim().length < 2) return;
    setActiveView("home");
    void runSearch(debouncedSearchQuery);
  }, [debouncedSearchQuery, runSearch, searchQuery]);

  const fetchLyrics = async (song: Song) => {
    setLyrics("");
    setLyricsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/lyrics?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.author)}`
      );
      const data = res.ok ? await res.json() : { lyrics: "Lyrics not found." };
      setLyrics(data.lyrics || "Lyrics not found.");
    } catch {
      setLyrics("Lyrics not found.");
    } finally {
      setLyricsLoading(false);
    }
  };

  const startTrack = useCallback(
    (song: Song, activeQueue: Song[], index: number, pushHistory: boolean) => {
      if (pushHistory && currentSong && currentSong.id !== song.id) {
        playHistoryRef.current.push(currentSong);
        if (playHistoryRef.current.length > 50) playHistoryRef.current.shift();
      }
      setQueue(activeQueue);
      setCurrentSongIndex(index);
      setCurrentSong(song);
      setIsPlaying(true);
      setError(null);
      recordPlayStart(song);
      lastHistorySongIdRef.current = song.id;
      lastHistoryTickRef.current = Date.now();
      recentPlayedIdsRef.current = [
        song.id,
        ...recentPlayedIdsRef.current.filter((id) => id !== song.id),
      ].slice(0, 10);
      if (isShuffle && activeQueue.length > 1) {
        shuffledOrderRef.current = buildShuffledIndices(activeQueue.length, index);
      } else {
        shuffledOrderRef.current = null;
      }
      fetchLyrics(song);
    },
    [currentSong, isShuffle]
  );

  const playSong = useCallback(
    (song: Song, customQueue?: Song[]) => {
      const activeQueue = customQueue?.length ? [...customQueue] : [song];
      const index = activeQueue.findIndex((s) => s.id === song.id);
      startTrack(song, activeQueue, index >= 0 ? index : 0, true);
    },
    [startTrack]
  );

  const playPlaylist = useCallback(
    (playlist: UserPlaylist) => {
      const fresh = getPlaylistById(playlist.id) ?? playlist;
      if (fresh.songs.length === 0) {
        setError("This playlist has no tracks yet.");
        return;
      }
      playSong(fresh.songs[0], fresh.songs);
    },
    [playSong]
  );

  const skipToNext = useCallback(
    (countAsSkip = true) => {
      if (queue.length === 0 || currentSongIndex === -1) return;
      if (countAsSkip && currentSong) recordSkip(currentSong);

      if (currentSong) {
        playHistoryRef.current.push(currentSong);
        if (playHistoryRef.current.length > 50) playHistoryRef.current.shift();
      }

      let nextIndex = resolveNextIndex(
        currentSongIndex,
        queue.length,
        repeatMode,
        isShuffle,
        shuffledOrderRef.current
      );

      let activeQueue = queue;

      if (nextIndex === null && isShuffle && shufflePool.length > 0) {
        const avoid = new Set(recentPlayedIdsRef.current);
        if (currentSong) avoid.add(currentSong.id);
        const random = pickRandomFromPool(shufflePool, avoid);
        if (random) {
          if (!activeQueue.some((s) => s.id === random.id)) {
            activeQueue = [...activeQueue, random];
            setQueue(activeQueue);
          }
          nextIndex = activeQueue.findIndex((s) => s.id === random.id);
        }
      }

      if (nextIndex === null || nextIndex < 0) {
        setIsPlaying(false);
        return;
      }

      const nextSong = activeQueue[nextIndex];
      startTrack(nextSong, activeQueue, nextIndex, false);
    },
    [queue, currentSongIndex, currentSong, repeatMode, isShuffle, shufflePool, startTrack]
  );

  const skipToPrevious = useCallback(
    (countAsSkip = true) => {
      if (queue.length === 0 || currentSongIndex === -1) return;

      if (playHistoryRef.current.length > 0) {
        if (countAsSkip && currentSong) recordSkip(currentSong);
        const prev = playHistoryRef.current.pop()!;
        let activeQueue = queue;
        let idx = activeQueue.findIndex((s) => s.id === prev.id);
        if (idx < 0) {
          activeQueue = [prev, ...activeQueue];
          setQueue(activeQueue);
          idx = 0;
        }
        startTrack(prev, activeQueue, idx, false);
        return;
      }

      if (countAsSkip && currentSong) recordSkip(currentSong);
      const prevIndex = resolvePreviousIndex(
        currentSongIndex,
        queue.length,
        isShuffle,
        shuffledOrderRef.current
      );
      if (prevIndex === null) return;
      startTrack(queue[prevIndex], queue, prevIndex, false);
    },
    [queue, currentSongIndex, currentSong, isShuffle, startTrack]
  );

  useEffect(() => {
    if (isShuffle && queue.length > 1 && currentSongIndex >= 0) {
      shuffledOrderRef.current = buildShuffledIndices(queue.length, currentSongIndex);
    } else if (!isShuffle) {
      shuffledOrderRef.current = null;
    }
  }, [isShuffle, queue.length, currentSongIndex]);

  const togglePlay = () => setIsPlaying((prev) => !prev);

  const toggleFavorite = async (song: Song) => {
    const exists = favorites.some((f) => f.id === song.id);
    const next = exists ? favorites.filter((f) => f.id !== song.id) : [...favorites, song];
    setFavorites(next);
    saveFavorites(next);
  };

  const handleCreatePlaylist = async (name: string) => {
    createPlaylistLocal(name);
    refreshPlaylists();
  };

  const handleDeletePlaylist = async () => {
    if (!selectedPlaylist) return;
    deletePlaylistLocal(selectedPlaylist.id);
    refreshPlaylists();
    setSelectedPlaylist(null);
    setActiveView("home");
  };

  const handleAddToPlaylist = async (playlistId: string, song: Song, _existing: Song[]) => {
    addSongLocal(playlistId, song);
    refreshPlaylists();
  };

  const handleRemoveFromPlaylist = async (playlistId: string, songId: string, _existing: Song[]) => {
    removeSongLocal(playlistId, songId);
    refreshPlaylists();
  };

  const goHome = () => {
    setSearchResults([]);
    setActiveView("home");
    setSelectedPlaylist(null);
  };

  if (showAnnouncement) {
    return (
      <AnnouncementScreen
        onContinue={() => {
          acknowledgeAnnouncement();
          setShowAnnouncement(false);
        }}
      />
    );
  }

  if (!user) {
    return <WelcomeScreen onEnter={handleEnterName} />;
  }

  const navItems: { id: AppView; icon: React.ReactNode; label: string; onClick: () => void }[] = [
    { id: "home", icon: <Home className="h-5 w-5" />, label: "Home", onClick: goHome },
    {
      id: "playlists",
      icon: <ListMusic className="h-5 w-5" />,
      label: "Playlists",
      onClick: () => {
        setSearchResults([]);
        setSelectedPlaylist(null);
        setActiveView("playlists");
      },
    },
    {
      id: "favorites",
      icon: <Heart className="h-5 w-5" />,
      label: "Favorites",
      onClick: () => {
        setSearchResults([]);
        setSelectedPlaylist(null);
        setActiveView("favorites");
      },
    },
    {
      id: "listening",
      icon: <Clock className="h-5 w-5" />,
      label: "Listening time",
      onClick: () => {
        setSearchResults([]);
        setSelectedPlaylist(null);
        setActiveView("listening");
      },
    },
  ];

  const initial = user.name.charAt(0).toUpperCase();

  return (
    <MusicContext.Provider
      value={{
        currentSong,
        isPlaying,
        setIsPlaying,
        playSong,
        playPlaylist,
        openPlaylist,
        togglePlay,
        favorites,
        toggleFavorite,
        playlists,
        createPlaylist: handleCreatePlaylist,
        deletePlaylist: async (id) => {
          deletePlaylistLocal(id);
          refreshPlaylists();
          if (selectedPlaylist?.id === id) {
            setSelectedPlaylist(null);
            setActiveView("playlists");
          }
        },
        addSongToPlaylist: handleAddToPlaylist,
        removeSongFromPlaylist: handleRemoveFromPlaylist,
        user,
        error,
        clearError,
        queue,
        currentSongIndex,
        skipToNext,
        skipToPrevious,
        isShuffle,
        setIsShuffle,
        repeatMode,
        setRepeatMode,
        cycleRepeatMode,
        lyrics,
        lyricsLoading,
        showLyrics,
        setShowLyrics,
      }}
    >
      <AmbientCanvas isPlaying={isPlaying} />
      <BGPattern variant="dots" mask="fade-edges" fill="rgba(139, 92, 246, 0.12)" size={32} className="z-0" />
      <div className="gradient-bg" />

      <div className="relative z-10 flex h-screen w-full overflow-hidden">
        <aside className="flex h-full w-20 shrink-0 flex-col items-center gap-10 border-r border-white/5 glass py-10">
          <Logo size="md" className="rounded-xl" />
          <nav className="flex flex-1 flex-col gap-6">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={item.onClick}
                title={item.label}
                className={cn(
                  "cursor-pointer rounded-xl p-2 transition-colors hover:text-white",
                  activeView === item.id || (item.id === "playlists" && activeView === "playlist-detail")
                    ? "bg-violet-500/20 text-violet-300"
                    : "text-white/40"
                )}
              >
                {item.icon}
              </button>
            ))}
          </nav>
          <a
            href="https://github.com/NayanGhimire"
            target="_blank"
            rel="noopener noreferrer"
            title="Developed by Nayan Ghimire"
            className="text-white/40 transition-colors hover:text-violet-400"
          >
            <Github className="h-5 w-5" />
          </a>
          <button
            onClick={handleChangeName}
            title={`Signed in as ${user.name} — click to change name`}
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-indigo-400 bg-indigo-600/30 text-sm font-bold text-white transition-colors hover:bg-indigo-500/40"
          >
            {initial}
          </button>
        </aside>

        <div className="flex flex-1 flex-col overflow-y-auto">
          <header className="flex h-20 shrink-0 items-center justify-between gap-4 px-8 md:px-12">
            <Logo size="sm" className="md:hidden shrink-0" />
            <form onSubmit={handleSearch} className="mx-2 max-w-lg flex-1 md:mx-4">
              <div className="relative">
                <SearchIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  placeholder="Search for music..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-full glass-dark py-2.5 pl-11 pr-6 text-sm font-medium transition-all focus:border-indigo-500/50 focus:outline-none"
                />
              </div>
            </form>
            <div className="hidden items-center gap-4 rounded-full glass px-6 py-2 md:flex">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                Hi, {user.name}
              </span>
              <span className="text-white/20">|</span>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                {currentSong ? currentSong.title.slice(0, 22) : "No track"}
              </span>
              {isPlaying && (
                <div className="flex h-4 items-end gap-0.5">
                  <div className="eq-bar" />
                  <div className="eq-bar" />
                  <div className="eq-bar" />
                </div>
              )}
            </div>
          </header>

          <main className="flex-1 px-8 py-6 pb-36 md:px-12">
            {loading ? (
              <SearchResultsSkeleton />
            ) : searchResults.length > 0 ? (
              <section>
                <h2 className="mb-8 text-3xl font-bold tracking-tight">Search Results</h2>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {searchResults.map((song) => (
                    <SongCard key={song.id} song={song} songList={searchResults} />
                  ))}
                </div>
              </section>
            ) : activeView === "playlist-detail" && selectedPlaylist ? (
              <PlaylistDetailView
                playlist={selectedPlaylist}
                onBack={() => {
                  setActiveView("playlists");
                  setSelectedPlaylist(null);
                }}
                onPlayAll={() => playPlaylist(selectedPlaylist)}
                onDelete={handleDeletePlaylist}
              />
            ) : activeView === "favorites" ? (
              <section>
                <h2 className="mb-8 flex items-center gap-4 text-3xl font-bold tracking-tight">
                  <Heart className="fill-indigo-500 text-indigo-500" /> Favorites
                </h2>
                {favorites.length > 0 ? (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {favorites.map((song) => (
                      <SongCard key={song.id} song={song} songList={favorites} />
                    ))}
                  </div>
                ) : (
                  <div className="glass rounded-3xl border border-dashed border-white/10 py-16 text-center">
                    <Heart className="mx-auto mb-3 h-10 w-10 text-indigo-500/40" />
                    <p className="text-white/50">No favorites yet</p>
                    <p className="mt-1 text-sm text-white/35">Tap the heart on any track to save it here</p>
                  </div>
                )}
              </section>
            ) : activeView === "listening" ? (
              <section>
                <h2 className="mb-8 text-3xl font-bold tracking-tight">Listening time</h2>
                <ListeningTimePanel
                  currentUserName={user.name}
                  sessionId={getSessionId()}
                  liveSeconds={getPendingListeningSeconds()}
                />
              </section>
            ) : activeView === "playlists" ? (
              <section className="space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-bold tracking-tight">Your Playlists</h2>
                  <button
                    onClick={() => setCreatePlaylistOpen(true)}
                    className="rounded-full border border-violet-500/30 px-5 py-2 text-sm text-violet-200 transition-colors hover:bg-violet-500/10"
                  >
                    + New playlist
                  </button>
                </div>
                {playlists.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        onClick={() => openPlaylist(pl.id)}
                        className="w-full text-left"
                      >
                        <div className="glass group cursor-pointer rounded-3xl p-4 transition-all hover:bg-white/[0.08]">
                          <div className="relative mb-4 aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-violet-900/50 to-fuchsia-900/30">
                            {pl.songs[0]?.thumbnail ? (
                              <img src={pl.songs[0].thumbnail} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <ListMusic className="h-12 w-12 text-violet-400/40" />
                              </div>
                            )}
                          </div>
                          <h3 className="truncate font-bold">{pl.name}</h3>
                          <p className="text-xs text-white/40">{pl.songs.length} tracks</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="glass rounded-3xl border border-dashed border-white/10 py-16 text-center">
                    <ListMusic className="mx-auto mb-3 h-10 w-10 text-violet-400/40" />
                    <p className="text-white/50">No playlists yet</p>
                    <p className="mt-1 text-sm text-white/35">Create one to organize your music</p>
                  </div>
                )}
              </section>
            ) : (
              <HomeView
                userName={user.name}
                sessionId={getSessionId()}
                liveListeningSeconds={getPendingListeningSeconds()}
                sections={recommendations}
                playlists={playlists}
                homeMix={homeMix}
                loading={recsLoading}
                onRefresh={loadRecommendations}
                onPlayMix={() => homeMix.length > 0 && playSong(homeMix[0], homeMix)}
                onOpenPlaylist={(pl) => openPlaylist(pl.id)}
                onPlayPlaylist={playPlaylist}
                onCreatePlaylist={() => setCreatePlaylistOpen(true)}
              />
            )}
          </main>
        </div>
      </div>

      <PlayerBar
        music={{
          currentSong,
          isPlaying,
          setIsPlaying,
          togglePlay,
          toggleFavorite,
          favorites,
          skipToNext,
          skipToPrevious,
          isShuffle,
          setIsShuffle,
          repeatMode,
          cycleRepeatMode,
          setShowLyrics,
          clearError,
        }}
      />

      <CreatePlaylistDialog
        open={createPlaylistOpen}
        onClose={() => setCreatePlaylistOpen(false)}
        onCreate={handleCreatePlaylist}
      />

      <AnimatePresence>{error && <Toast message={error} onClose={clearError} />}</AnimatePresence>

      <AnimatePresence>
        {showLyrics && currentSong && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-black/95 p-8 backdrop-blur-3xl md:p-12"
          >
            <button
              onClick={() => setShowLyrics(false)}
              className="absolute right-8 top-8 z-[70] cursor-pointer rounded-full glass p-3 hover:bg-white/10"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="relative mx-auto w-full max-w-3xl pt-20">
              <div className="mb-20 flex flex-col items-center gap-12 md:flex-row md:items-start">
                <img
                  src={currentSong.thumbnail}
                  alt=""
                  className="album-glow h-64 w-64 animate-float rounded-[40px] object-cover shadow-2xl"
                />
                <div className="pt-4 text-center md:text-left">
                  <h2 className="mb-6 text-5xl font-bold leading-none tracking-tighter text-white drop-shadow-2xl md:text-7xl">
                    {currentSong.title}
                  </h2>
                  <p className="font-serif text-3xl italic text-indigo-400 opacity-80">{currentSong.author}</p>
                </div>
              </div>
              <div className="space-y-8 pb-32 pr-8 font-serif text-3xl italic leading-tight text-white/60 md:text-4xl">
                {lyricsLoading ? (
                  [1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-2xl bg-white/5" style={{ width: `${90 - i * 10}%` }} />
                  ))
                ) : lyrics ? (
                  lyrics.split("\n").map((line, i) => (
                    <motion.p key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}>
                      {line}
                    </motion.p>
                  ))
                ) : (
                  <p className="opacity-40">No lyrics found.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MusicContext.Provider>
  );
}
