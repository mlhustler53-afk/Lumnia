/** Production Render backend (used if VITE_API_URL is missing on Vercel build). */
const DEFAULT_PRODUCTION_API = "https://lumnia-bej6.onrender.com";

/** API base URL — empty in local dev so Vite proxies /api to localhost:3001. */
export function getApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (import.meta.env.PROD) return DEFAULT_PRODUCTION_API;
  return "";
}
