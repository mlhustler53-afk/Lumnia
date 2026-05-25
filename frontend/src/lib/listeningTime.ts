import type { ListeningStat } from "@/types";

const SESSION_KEY = "lumina_session_id";

let pendingSeconds = 0;

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function tickListeningSecond() {
  pendingSeconds += 1;
}

export function getPendingListeningSeconds(): number {
  return pendingSeconds;
}

export function takePendingListeningSeconds(): number {
  const seconds = pendingSeconds;
  pendingSeconds = 0;
  return seconds;
}

export function formatListeningDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  if (sec < 60) return `${sec}s`;
  const mins = Math.floor(sec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (remMins === 0) return `${hours}h`;
  return `${hours}h ${remMins}m`;
}

export async function syncListeningTime(
  apiBase: string,
  id: string,
  name: string,
  seconds: number
): Promise<number | null> {
  if (seconds <= 0) return null;
  try {
    const res = await fetch(`${apiBase}/api/listening`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, seconds }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { totalSeconds?: number };
    return data.totalSeconds ?? null;
  } catch {
    return null;
  }
}

export async function fetchListeningStats(apiBase: string): Promise<ListeningStat[]> {
  try {
    const res = await fetch(`${apiBase}/api/listening`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
