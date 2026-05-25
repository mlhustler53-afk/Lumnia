import { useEffect, useState, useCallback } from "react";
import { Clock, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchListeningStats, formatListeningDuration } from "@/lib/listeningTime";
import type { ListeningStat } from "@/types";
import { cn } from "@/lib/utils";
import { getApiBase } from "@/lib/api";

const API_BASE = getApiBase();

interface ListeningTimePanelProps {
  currentUserName: string;
  sessionId: string;
  liveSeconds?: number;
  compact?: boolean;
}

export function ListeningTimePanel({
  currentUserName,
  sessionId,
  liveSeconds = 0,
  compact,
}: ListeningTimePanelProps) {
  const [stats, setStats] = useState<ListeningStat[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await fetchListeningStats(API_BASE));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const you =
    stats.find((s) => s.id === sessionId) ??
    stats.find((s) => s.name.toLowerCase() === currentUserName.toLowerCase());
  const yourTotal = (you?.totalSeconds ?? 0) + liveSeconds;
  const listeningNow = stats.filter((s) => s.isListening).length;

  return (
    <section
      className={cn(
        "rounded-3xl border border-violet-500/20 bg-black/30 backdrop-blur-xl",
        compact ? "p-4" : "p-6 md:p-8"
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20">
            <Clock className="h-5 w-5 text-violet-300" />
          </div>
          <div>
            <h2 className={cn("font-bold tracking-tight text-white", compact ? "text-base" : "text-xl")}>
              Listening time
            </h2>
            <p className="text-xs text-white/45">
              {loading
                ? "Loading…"
                : `You've listened for ${formatListeningDuration(yourTotal)}${
                    listeningNow > 0 ? ` · ${listeningNow} listening now` : ""
                  }`}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={load}
          disabled={loading}
          className="shrink-0 text-white/40 hover:text-white"
          title="Refresh stats"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {loading && stats.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400/50" />
        </div>
      ) : stats.length === 0 ? (
        <p className="py-4 text-center text-sm text-white/40">
          Play some music — your listening time will show up here.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {stats.map((entry) => {
            const isYou = entry.id === sessionId;
            const displaySeconds = isYou ? entry.totalSeconds + liveSeconds : entry.totalSeconds;
            return (
              <li
                key={entry.id}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                  isYou
                    ? "border-violet-400/50 bg-violet-500/15 text-violet-100"
                    : "border-white/10 bg-white/[0.04] text-white/80"
                )}
              >
                {entry.isListening && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                    title="Listening now"
                  />
                )}
                <span className="font-medium">{entry.name}</span>
                <span className="text-[10px] font-bold tabular-nums tracking-wider text-violet-300/90">
                  {formatListeningDuration(displaySeconds)}
                </span>
                {isYou && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300/80">
                    you
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
