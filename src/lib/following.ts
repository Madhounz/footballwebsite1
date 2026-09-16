/**
 * The clubs someone follows.
 *
 * Kept on the device rather than in an account: a scores site should not ask
 * for a sign-up before it will tell you when your team plays, and the list is
 * three lines of JSON, not something worth holding on a server. When push
 * notifications arrive this same list is what a subscription will carry.
 *
 * These functions are pure so the rules can be tested without a browser; the
 * hook in `useFollowing` supplies the storage.
 */

export const FOLLOWING_KEY = "ninety:following";
/** More than this is not a list of clubs you follow, it is a list of clubs. */
export const FOLLOW_LIMIT = 20;

/** Parses stored JSON defensively: anything unexpected means nobody is followed. */
export function parseFollowing(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return [
      ...new Set(value.filter((v): v is string => typeof v === "string" && v.length > 0)),
    ].slice(0, FOLLOW_LIMIT);
  } catch {
    return [];
  }
}

/** Follows or unfollows, keeping the order clubs were added in. */
export function toggleFollowing(current: string[], teamId: string): string[] {
  if (current.includes(teamId)) return current.filter((id) => id !== teamId);
  return [...current, teamId].slice(-FOLLOW_LIMIT);
}

export function serialiseFollowing(ids: string[]): string {
  return JSON.stringify(ids.slice(0, FOLLOW_LIMIT));
}
