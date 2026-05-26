import { motion } from "motion/react";
import { AlertTriangle, Server, Radio, WrenchIcon, Clock } from "lucide-react";
import { Logo } from "@/components/Logo";

const ANNOUNCEMENT_LINES = [
  "SYSTEM LEVEL: v1.0.0 — Maintenance In Progress",
  "BACKEND: Node.js / Linux Server",
  "STATUS: Service Disruption Detected",
  "",
  "We are currently experiencing a service interruption caused by an internal",
  "resource allocation fault (ERR_RESOURCE_EXHAUSTION_LIMIT). Our engineering",
  "team has been notified and is actively working to resolve the issue.",
  "",
  "All core systems have been placed under scheduled maintenance while the",
  "fault is being diagnosed and patched. Estimated restoration time will be",
  "communicated as soon as a timeline is confirmed.",
  "",
  "We apologize for any inconvenience. Thank you for your patience.",
] as const;

export function AnnouncementScreen() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030305] p-4 sm:p-8">
      <div className="gradient-bg opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(234,179,8,0.08),_transparent_55%)]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-2xl"
      >
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo size="lg" showGlow />
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
            <WrenchIcon className="h-3.5 w-3.5" />
            Under Maintenance
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-amber-500/20 bg-black/70 shadow-2xl shadow-amber-950/30 backdrop-blur-md">
          <div className="border-b border-white/10 bg-amber-950/30 px-4 py-3 sm:px-6">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300/90 sm:text-xs">
              [ SYSTEM NOTICE — MAY 26, 2026 ]
            </p>
          </div>

          {/* Error banner */}
          <div className="flex items-center gap-3 border-b border-red-500/20 bg-red-950/30 px-4 py-3 sm:px-6">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <p className="font-mono text-xs font-semibold text-red-300 tracking-wide">
              FAULT CODE: ERR_RESOURCE_EXHAUSTION_LIMIT
            </p>
          </div>

          <div className="border-b border-dashed border-white/10 px-2 py-1 font-mono text-[10px] text-white/25 sm:px-4">
            {"-----------------------------------------------------------------"}
          </div>

          <div className="space-y-1 px-4 py-6 font-mono text-sm leading-relaxed text-amber-100/80 sm:px-6 sm:text-[14px]">
            {ANNOUNCEMENT_LINES.map((line, i) =>
              line === "" ? (
                <div key={i} className="h-3" />
              ) : (
                <p
                  key={i}
                  className={
                    line.startsWith("STATUS")
                      ? "font-semibold text-amber-400"
                      : line.startsWith("SYSTEM") || line.startsWith("BACKEND")
                      ? "font-semibold text-white/80"
                      : "text-white/60"
                  }
                >
                  {line}
                </p>
              )
            )}
          </div>

          <div className="border-t border-dashed border-white/10 px-2 py-1 font-mono text-[10px] text-white/25 sm:px-4">
            {"-----------------------------------------------------------------"}
          </div>

          <div className="grid gap-3 border-t border-white/5 bg-white/[0.02] p-4 sm:grid-cols-3 sm:p-6">
            <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/30 px-4 py-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">System</p>
                <p className="text-sm font-semibold text-white">v1.0.0</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/30 px-4 py-3">
              <Server className="h-5 w-5 shrink-0 text-violet-400" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Backend</p>
                <p className="text-sm font-semibold text-white">Node.js</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/30 px-4 py-3 sm:col-span-1">
              <Clock className="h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Status</p>
                <p className="text-sm font-semibold text-amber-400">Maintenance</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
