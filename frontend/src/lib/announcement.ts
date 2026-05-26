/** Set to false when you're done updating and want the app to open normally. */
export const ANNOUNCEMENT_ACTIVE = true;

export function isAnnouncementBlocking(): boolean {
  return ANNOUNCEMENT_ACTIVE;
}
