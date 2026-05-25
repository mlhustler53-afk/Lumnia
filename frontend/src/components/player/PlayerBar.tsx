import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Heart,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  Loader2,
  Shuffle,
  Repeat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { Song } from "@/types";
import { getApiBase } from "@/lib/api";

const API_BASE = getApiBase();

function parseTimestamp(ts?: string): number {
  if (!ts) return 0;
  const parts = ts.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function buildStreamUrl(videoId: string, startSec: number) {
  const base = `${API_BASE}/api/stream?id=${encodeURIComponent(videoId)}`;
  return startSec > 0 ? `${base}&t=${Math.floor(startSec)}` : base;
}

interface MusicContextPlayer {
  currentSong: Song | null;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  toggleFavorite: (song: Song) => void;
  favorites: { id: string }[];
  skipToNext: () => void;
  skipToPrevious: () => void;
  setShowLyrics: (show: boolean) => void;
  clearError: () => void;
}

interface PlayerBarProps {
  music: MusicContextPlayer;
}

export function PlayerBar({ music }: PlayerBarProps) {
  const {
    currentSong,
    isPlaying,
    setIsPlaying,
    togglePlay,
    toggleFavorite,
    favorites,
    skipToNext,
    skipToPrevious,
    setShowLyrics,
    clearError,
  } = music;

  const [displayTime, setDisplayTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [volume, setVolume] = useState(70);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [seekValue, setSeekValue] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamOffsetRef = useRef(0);
  const streamGenRef = useRef(0);
  const loadedSongIdRef = useRef<string | null>(null);
  const isSeekingRef = useRef(false);
  const shouldPlayRef = useRef(false);
  const audioUnlockedRef = useRef(false);

  const tryPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !shouldPlayRef.current) return;
    void audio.play().catch(() => setIsPlaying(false));
  }, [setIsPlaying]);

  // Unlock autoplay after the first user gesture (browsers block play() in async handlers).
  useEffect(() => {
    const unlock = () => {
      const audio = audioRef.current;
      if (!audio || audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;
      const wasPlaying = !audio.paused;
      const t = audio.currentTime;
      void audio
        .play()
        .then(() => {
          if (!wasPlaying) {
            audio.pause();
            audio.currentTime = t;
          }
        })
        .catch(() => {});
    };
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const getTotalDuration = useCallback(() => {
    const parsed = parseTimestamp(currentSong?.duration);
    if (parsed > 0) return parsed;
    const audio = audioRef.current;
    const fromAudio = audio?.duration;
    if (fromAudio && Number.isFinite(fromAudio) && fromAudio > 0) {
      return streamOffsetRef.current + fromAudio;
    }
    return totalDuration;
  }, [currentSong?.duration, totalDuration]);

  const loadStreamAt = useCallback(
    (startSec: number, autoplay: boolean) => {
      const audio = audioRef.current;
      if (!audio || !currentSong) return;

      streamOffsetRef.current = Math.max(0, startSec);
      shouldPlayRef.current = autoplay;
      streamGenRef.current += 1;
      const gen = streamGenRef.current;

      setIsBuffering(true);
      setDisplayTime(startSec);
      if (!isSeekingRef.current) setSeekValue(startSec);

      audio.src = buildStreamUrl(currentSong.id, startSec);
      audio.load();
      if (autoplay) tryPlay();

      const onReady = () => {
        if (streamGenRef.current !== gen) return;
        setIsBuffering(false);
        const parsed = parseTimestamp(currentSong.duration);
        const segmentLen = audio.duration;
        if (parsed > 0) {
          setTotalDuration(parsed);
        } else if (segmentLen && Number.isFinite(segmentLen)) {
          setTotalDuration(streamOffsetRef.current + segmentLen);
        }
        if (shouldPlayRef.current) tryPlay();
        audio.removeEventListener("canplay", onReady);
        audio.removeEventListener("loadeddata", onReady);
      };

      audio.addEventListener("canplay", onReady);
      audio.addEventListener("loadeddata", onReady);
    },
    [currentSong, tryPlay]
  );

  // New track — start from beginning
  useEffect(() => {
    if (!currentSong) return;
    if (loadedSongIdRef.current === currentSong.id) return;

    loadedSongIdRef.current = currentSong.id;
    streamOffsetRef.current = 0;
    const parsed = parseTimestamp(currentSong.duration);
    setTotalDuration(parsed);
    setDisplayTime(0);
    setSeekValue(0);
    loadStreamAt(0, isPlaying);
  }, [currentSong?.id, currentSong?.duration, isPlaying, loadStreamAt]);

  // Play / pause only (do not reload stream)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong || loadedSongIdRef.current !== currentSong.id) return;

    if (isPlaying) {
      shouldPlayRef.current = true;
      if (audio.readyState >= 2) {
        tryPlay();
      }
    } else {
      shouldPlayRef.current = false;
      audio.pause();
    }
  }, [isPlaying, currentSong?.id, tryPlay]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || isSeekingRef.current) return;

    const absolute = streamOffsetRef.current + (audio.currentTime || 0);
    setDisplayTime(absolute);

    const parsed = parseTimestamp(currentSong?.duration);
    if (parsed > 0) {
      setTotalDuration(parsed);
    } else if (audio.duration && Number.isFinite(audio.duration)) {
      setTotalDuration(streamOffsetRef.current + audio.duration);
    }

    setSeekValue(absolute);
  };

  const handleError = () => {
    setIsPlaying(false);
    setIsBuffering(false);
    loadedSongIdRef.current = null;

    if (currentSong) {
      clearError();
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("lumina-error", {
            detail: "Playback failed — try another track or skip ahead again.",
          })
        );
      }, 100);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time < 0) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const seekTo = (targetSec: number) => {
    const max = getTotalDuration();
    const clamped = max > 0 ? Math.max(0, Math.min(max, targetSec)) : Math.max(0, targetSec);
    isSeekingRef.current = false;
    loadStreamAt(clamped, isPlaying);
  };

  const handleSeekChange = (value: number[]) => {
    isSeekingRef.current = true;
    setSeekValue(value[0]);
  };

  const handleSeekCommit = (value: number[]) => {
    seekTo(value[0]);
  };

  const seekBy = (seconds: number) => {
    const audio = audioRef.current;
    const current = audio
      ? streamOffsetRef.current + (audio.currentTime || 0)
      : displayTime;
    seekTo(current + seconds);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => {
      if (prev === "off") return "all";
      if (prev === "all") return "one";
      return "off";
    });
  };

  const handleEnded = () => {
    if (repeatMode === "one") {
      seekTo(0);
      return;
    }
    skipToNext();
  };

  if (!currentSong) return null;

  const isFav = favorites.some((f) => f.id === currentSong.id);
  const durationMax = getTotalDuration() || 100;

  return (
    <>
      <audio
        ref={audioRef}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onEnded={handleEnded}
        onError={handleError}
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 md:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key="player-bar"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mx-auto max-w-5xl"
          >
            <Card className="border-violet-500/20 bg-black/40 py-4 shadow-2xl shadow-violet-500/10 backdrop-blur-xl">
              <div className="flex flex-col gap-4 px-4 md:px-6">
                <div className="flex flex-col items-center gap-4 md:flex-row">
                  <div className="flex w-full min-w-0 items-center gap-4 md:w-1/3">
                    <div className="relative shrink-0">
                      <img
                        src={currentSong.thumbnail}
                        alt=""
                        className="album-glow h-14 w-14 rounded-xl object-cover md:h-16 md:w-16"
                      />
                      {isBuffering && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <h4 className="truncate text-sm font-bold tracking-tight text-white">
                        {currentSong.title}
                      </h4>
                      <p className="truncate text-xs font-serif italic text-violet-300 opacity-80">
                        {currentSong.author}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleFavorite(currentSong)}
                      className={cn(
                        "shrink-0",
                        isFav ? "text-pink-500 hover:text-pink-600" : "text-gray-400 hover:text-white"
                      )}
                    >
                      <Heart className={cn("h-5 w-5", isFav && "fill-current")} />
                    </Button>
                  </div>

                  <div className="flex w-full flex-1 flex-col items-center gap-3">
                    <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsShuffle(!isShuffle)}
                        className={cn("text-gray-400 hover:text-white", isShuffle && "text-violet-400")}
                        title="Shuffle"
                      >
                        <Shuffle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={skipToPrevious}
                        className="text-gray-400 hover:text-white"
                        title="Previous track"
                      >
                        <SkipBack className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => seekBy(-15)}
                        disabled={isBuffering}
                        className="min-w-[3rem] rounded-full border border-white/10 px-2.5 text-xs font-semibold text-gray-400 hover:border-violet-500/30 hover:text-white disabled:opacity-40"
                        title="Rewind 15 seconds"
                      >
                        -15s
                      </Button>
                      <Button
                        size="icon"
                        onClick={togglePlay}
                        className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/50 hover:from-violet-600 hover:to-purple-700"
                      >
                        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => seekBy(15)}
                        disabled={isBuffering}
                        className="min-w-[3rem] rounded-full border border-white/10 px-2.5 text-xs font-semibold text-gray-400 hover:border-violet-500/30 hover:text-white disabled:opacity-40"
                        title="Forward 15 seconds"
                      >
                        +15s
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={skipToNext}
                        className="text-gray-400 hover:text-white"
                        title="Next track"
                      >
                        <SkipForward className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleRepeat}
                        className={cn(
                          "relative text-gray-400 hover:text-white",
                          repeatMode !== "off" && "text-violet-400"
                        )}
                        title="Repeat"
                      >
                        <Repeat className="h-4 w-4" />
                        {repeatMode === "one" && (
                          <span className="absolute text-[10px] font-bold">1</span>
                        )}
                      </Button>
                    </div>
                    <div className="flex w-full items-center gap-3 px-2">
                      <span className="w-10 shrink-0 text-[10px] font-bold tabular-nums tracking-widest text-muted-foreground">
                        {formatTime(displayTime)}
                      </span>
                      <Slider
                        value={[seekValue]}
                        max={durationMax}
                        step={1}
                        onValueChange={handleSeekChange}
                        onValueCommit={handleSeekCommit}
                        className="flex-1"
                        disabled={isBuffering && durationMax <= 100}
                      />
                      <span className="w-10 shrink-0 text-right text-[10px] font-bold tabular-nums tracking-widest text-muted-foreground">
                        {formatTime(totalDuration > 0 ? totalDuration : durationMax)}
                      </span>
                    </div>
                  </div>

                  <div className="hidden w-full items-center justify-end gap-4 md:flex md:w-1/4">
                    <Button
                      variant="ghost"
                      onClick={() => setShowLyrics(true)}
                      className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-white"
                    >
                      Lyrics
                    </Button>
                    <Volume2 className="h-4 w-4 shrink-0 text-gray-400" />
                    <Slider
                      value={[volume]}
                      max={100}
                      step={1}
                      onValueChange={handleVolumeChange}
                      className="w-24"
                    />
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
