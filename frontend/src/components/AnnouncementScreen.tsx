import { motion } from "motion/react";
import { CheckCircle2, Server, Radio } from "lucide-react";
import { Logo } from "@/components/Logo";

const ANNOUNCEMENT_LINES = [
  "SYSTEM LEVEL: v1.0.0 Live Deployment Complete",
  "BACKEND: Node.js / Linux Server Optimized",
  "STATUS: Operational",
  "",
  "Notice: All core streaming protocols and API pathways are fully functional.",
  "Database sync is currently running at 100% efficiency. More modules dropping soon.",
] as const;

export function AnnouncementScreen() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030305] p-4 sm:p-8">
      <div className="gradient-bg opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.12),_transparent_55%)]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-2xl"
      >
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo size="lg" showGlow />
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            Live
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-violet-500/25 bg-black/70 shadow-2xl shadow-violet-950/50 backdrop-blur-md">
          <div className="border-b border-white/10 bg-violet-950/40 px-4 py-3 sm:px-6">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-violet-300/90 sm:text-xs">
              [ ANNOUNCEMENT — MAY 26, 2026 ]
            </p>
          </div>

          <div className="border-b border-dashed border-white/10 px-2 py-1 font-mono text-[10px] text-white/25 sm:px-4">
            {"-----------------------------------------------------------------"}
          </div>

          <div className="space-y-1 px-4 py-6 font-mono text-sm leading-relaxed text-emerald-100/90 sm:px-6 sm:text-[15px]">
            {ANNOUNCEMENT_LINES.map((line, i) =>
              line === "" ? (
                <div key={i} className="h-3" />
              ) : (
                <p key={i} className={line.startsWith("STATUS") ? "font-semibold text-emerald-400" : ""}>
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
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
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
              <Radio className="h-5 w-5 shrink-0 text-fuchsia-400" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Status</p>
                <p className="text-sm font-semibold text-emerald-400">Operational</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
