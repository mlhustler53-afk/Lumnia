import type { AppListener } from "@/types";

const SESSION_KEY = "lumina_session_id";

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export async function registerListener(apiBase: string, name: string): Promise<void> {
  await fetch(`${apiBase}/api/listeners`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: getSessionId(), name }),
  });
}

export async function fetchListeners(apiBase: string): Promise<AppListener[]> {
  const res = await fetch(`${apiBase}/api/listeners`);
  if (!res.ok) return [];
  return res.json();
}
