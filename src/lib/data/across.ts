import type { ScorerRow } from "../types";

/**
 * Every scorer chart we hold, added together.
 *
 * A league's chart answers "who is scoring in England". Nobody follows only
 * England. The question fans actually argue about — who has scored the most
 * this season, full stop — needs every competition at once, and the answer
 * has been sitting in the database all along as eleven separate lists.
 *
 * It is addition, not judgement: a player's goals in each competition, added
 * up, with the parts kept so the reader can see where the total came from.
 * Seventeen is not seventeen if fourteen of them came in a second division,
 * and a total that hides that is a worse number than no total. Nothing here
 * weights or ranks competitions against each other, because that is an
 * opinion and this is a sum.
 */
export interface AcrossPart {
  competitionId: string;
  teamId: string;
  goals: number;
  assists: number;
}

export interface AcrossRow {
  playerId: string;
  /** The club he scored most of them for — a January move leaves two. */
  teamId: string;
  goals: number;
  assists: number;
  penalties: number;
  appearances: number;
  /** Where the goals came from, most first. Always at least one. */
  parts: AcrossPart[];
}

export function goalsAcross(
  charts: { competitionId: string; rows: ScorerRow[] }[],
  limit = 25,
): AcrossRow[] {
  const byPlayer = new Map<string, AcrossRow>();
  for (const { competitionId, rows } of charts) {
    for (const r of rows) {
      // A chart row with no goals is an assists row riding along; it belongs
      // in the totals but must not invent a part with nothing in it.
      const row = byPlayer.get(r.playerId);
      if (!row) {
        byPlayer.set(r.playerId, {
          playerId: r.playerId,
          teamId: r.teamId,
          goals: r.goals,
          assists: r.assists,
          penalties: r.penalties,
          appearances: r.appearances,
          parts: [{ competitionId, teamId: r.teamId, goals: r.goals, assists: r.assists }],
        });
        continue;
      }
      row.goals += r.goals;
      row.assists += r.assists;
      row.penalties += r.penalties;
      row.appearances += r.appearances;
      row.parts.push({ competitionId, teamId: r.teamId, goals: r.goals, assists: r.assists });
    }
  }
  for (const row of byPlayer.values()) {
    row.parts.sort((a, b) => b.goals - a.goals || a.competitionId.localeCompare(b.competitionId));
    row.teamId = row.parts[0].teamId;
  }
  return [...byPlayer.values()]
    .filter((r) => r.goals > 0)
    .sort(
      (a, b) =>
        b.goals - a.goals ||
        b.assists - a.assists ||
        a.appearances - b.appearances ||
        a.playerId.localeCompare(b.playerId),
    )
    .slice(0, limit);
}
