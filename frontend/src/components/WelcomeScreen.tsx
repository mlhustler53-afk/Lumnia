import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

interface WelcomeScreenProps {
  onEnter: (name: string) => void;
}

export function WelcomeScreen({ onEnter }: WelcomeScreenProps) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onEnter(trimmed);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#040406] p-4">
      <div className="gradient-bg opacity-100" />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md rounded-[40px] border border-white/10 glass p-12 text-center"
      >
          <div className="mx-auto mb-8 flex justify-center">
            <Logo size="xl" showGlow />
          </div>
        <h1 className="mb-4 text-4xl font-bold tracking-tight">Lumina Music</h1>
        <p className="mb-8 font-medium font-serif italic text-white/50">
          Enter your name to start listening — no account needed.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            autoFocus
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 text-center text-lg focus:border-violet-500/50 focus:outline-none"
          />
          <Button
            type="submit"
            disabled={!name.trim()}
            className="h-12 w-full rounded-2xl bg-white text-base font-bold text-black hover:bg-white/90"
          >
            Start listening
          </Button>
        </form>
        <div className="mt-8 text-xs text-white/40">
          Developed by{" "}
          <a
            href="https://github.com/NayanGhimire"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-violet-400 transition-colors hover:text-violet-300 hover:underline"
          >
            Nayan Ghimire
          </a>
        </div>
      </motion.div>
    </div>
  );
}
