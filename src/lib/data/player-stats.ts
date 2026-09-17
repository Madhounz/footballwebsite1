import type { ScorerRow } from "../types";

/**
 * A player's season, and where the numbers came from.
 *
 * The database holds two quite different things about a player. One is the
 * competition's own scorer chart, which the primary source publishes and we
 * store whole — goals, assists, penalties and appearances for everybody in it.
 * The other is our own count over the events of matches we fetched detail for,
 * which needs the secondary provider and is empty without it.
 *
 * Reading only the second is how a player page came to say a striker had
 * scored nothing all season while the top scorers table on the same site, out
 * of the same database, had him on eight. The chart comes first here, exactly
 * as it does for the table — same rule, same precedence, so the two pages
 * cannot contradict each other.
 *
 * And where we hold neither, the answer is not zero. Zero is a fact about a
 * player; "none" is a fact about us.
 */
export type StatsSource = "provider" | "matches" | "none";

export interface PlayerSeasonStats extends ScorerRow {
  source: StatsSource;
}

export function playerSeasonStats(input: {
  playerId: string;
  teamId: string;
  /** The provider's chart rows for this player, one per competition. */
  chart: ScorerRow[];
  /** What our own stored events say, where we hold any. */
  counted: ScorerRow | null;
  /** Appearances proved by a line-up, which beat a chart's own count. */
  appearances: number;
  /** Whether we hold any line-up or event for this player's club at all. */
  holdsDetail: boolean;
}): PlayerSeasonStats {
  const { playerId, teamId, chart, counted, appearances, holdsDetail } = input;
  if (chart.length > 0) {
    const sum = (pick: (r: ScorerRow) => number) => chart.reduce((n, r) => n + pick(r), 0);
    return {
      playerId,
      teamId,
      goals: sum((r) => r.goals),
      assists: sum((r) => r.assists),
      penalties: sum((r) => r.penalties),
      // A line-up says a player was on the pitch; a chart says how many times
      // the provider thinks he was. Prefer the one we can point at a match for.
      appearances: appearances > 0 ? appearances : sum((r) => r.appearances),
      source: "provider",
    };
  }
  if (holdsDetail) {
    return {
      playerId,
      teamId,
      goals: counted?.goals ?? 0,
      assists: counted?.assists ?? 0,
      penalties: counted?.penalties ?? 0,
      appearances: appearances || (counted?.appearances ?? 0),
      source: "matches",
    };
  }
  return { playerId, teamId, goals: 0, assists: 0, penalties: 0, appearances: 0, source: "none" };
}
