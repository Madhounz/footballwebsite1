/**
 * Readable, shareable match URLs: `arsenal-vs-chelsea-2026-09-19`.
 *
 * Internal match ids are `competition:date:home:away`, which is fine as a
 * database key but makes a poor URL: colons are easy for routers and proxies to
 * mishandle, and nobody can read the link they are pasting into a group chat.
 * The slug is derived, never stored as the source of truth, so it can change
 * shape later without re-keying anything.
 */
export function matchSlug(m: { homeTeamId: string; awayTeamId: string; kickoff: string }): string {
  return `${m.homeTeamId}-vs-${m.awayTeamId}-${m.kickoff.slice(0, 10)}`;
}
