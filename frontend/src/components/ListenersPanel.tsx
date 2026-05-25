import { useEffect, useState, useCallback } from "react";
import { Users, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchListeners } from "@/lib/listeners";
import type { AppListener } from "@/types";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface ListenersPanelProps {
  currentUserName: string;
  compact?: boolean;
}

function formatLastSeen(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ListenersPanel({ currentUserName, compact }: ListenersPanelProps) {
  const [listeners, setListeners] = useState<AppListener[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setListeners(await fetchListeners(API_BASE));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const onlineCount = listeners.filter((l) => l.online).length;

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
            <Users className="h-5 w-5 text-violet-300" />
          </div>
          <div>
            <h2 className={cn("font-bold tracking-tight text-white", compact ? "text-base" : "text-xl")}>
              Who&apos;s listening
            </h2>
            <p className="text-xs text-white/45">
              {loading
                ? "Loading…"
                : onlineCount > 0
                  ? `${onlineCount} online · ${listeners.length} total`
                  : `${listeners.length} ${listeners.length === 1 ? "person" : "people"} have joined`}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={load}
          disabled={loading}
          className="shrink-0 text-white/40 hover:text-white"
          title="Refresh list"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {loading && listeners.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400/50" />
        </div>
      ) : listeners.length === 0 ? (
        <p className="py-4 text-center text-sm text-white/40">
          No one else yet — you&apos;re the first on Lumina!
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {listeners.map((listener) => {
            const isYou =
              listener.name.toLowerCase() === currentUserName.toLowerCase();
            return (
              <li
                key={listener.id}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                  isYou
                    ? "border-violet-400/50 bg-violet-500/15 text-violet-100"
                    : "border-white/10 bg-white/[0.04] text-white/80"
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    listener.online ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-white/25"
                  )}
                  title={listener.online ? "Online now" : "Offline"}
                />
                <span className="font-medium">{listener.name}</span>
                {isYou && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300/80">
                    you
                  </span>
                )}
                {!listener.online && (
                  <span className="text-[10px] text-white/30">{formatLastSeen(listener.lastSeen)}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
