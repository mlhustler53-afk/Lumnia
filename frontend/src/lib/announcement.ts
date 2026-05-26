/** Flip to false when the deployment announcement period ends. */
export const ANNOUNCEMENT_ACTIVE = true;

export const ANNOUNCEMENT_VERSION = "v1.0.0-may-26-2026";

const STORAGE_KEY = "lumina_announcement_ack";

export function hasAcknowledgedAnnouncement(): boolean {
  if (!ANNOUNCEMENT_ACTIVE) return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === ANNOUNCEMENT_VERSION;
  } catch {
    return false;
  }
}

export function acknowledgeAnnouncement(): void {
  try {
    localStorage.setItem(STORAGE_KEY, ANNOUNCEMENT_VERSION);
  } catch {
    /* ignore */
  }
}

export function shouldShowAnnouncement(): boolean {
  return ANNOUNCEMENT_ACTIVE && !hasAcknowledgedAnnouncement();
}
