import type { FormResult, Match, StandingRow } from "../types";
import { computeStandings } from "./standings";

/**
 * Where a club has been in the table, matchday by matchday.
 *
 * A form guide says what happened five matches ago and a table says where the
 * club is now; neither says that they were fourth in September, spent October
 * in the bottom three and have climbed back since. That shape is the season a
 * supporter actually remembers, and it is derivable from the one thing we hold
 * for every match on every plan — the scoreline.
 *
 * The position after each round is the table as it stood that night, computed
 * by the same function the table itself uses, so a point on this line can
 * never disagree with the table it came from.
 */
export interface ArcPoint {
  round: number;
  /** Position in the table as it stood after that round. */
  position: number;
  points: number;
  played: number;
  /** The club's own result that round, where they played one. */
  result: FormResult | null;
  matchId: string | null;
}

function resultOf(m: Match, teamId: string): FormResult | null {
  if (!m.score) return null;
  const [own, other] =
    m.homeTeamId === teamId
      ? [m.score.home, m.score.away]
      : m.awayTeamId === teamId
        ? [m.score.away, m.score.home]
        : [null, null];
  if (own === null || other === null) return null;
  return own > other ? "W" : own < other ? "L" : "D";
}

/** The table as it stood after one round, by club. */
export interface RoundTable {
  round: number;
  rows: Map<string, StandingRow>;
}

/**
 * The season replayed: the whole table after each round it was played.
 *
 * One pass per round serves every club at once, so a page drawing twenty lines
 * costs what a page drawing one costs. It is also the only place the replay is
 * written, which is what keeps a club's line and a competition's race telling
 * the same story.
 */
export function replaySeason(
  competitionId: string,
  season: string,
  teamIds: string[],
  matches: Match[],
): RoundTable[] {
  const finished = matches.filter((m) => m.status === "finished" && m.score);
  const rounds = [...new Set(finished.map((m) => m.round))].sort((a, b) => a - b);
  return rounds.map((round) => {
    const { rows } = computeStandings(
      competitionId,
      season,
      teamIds,
      finished.filter((m) => m.round <= round),
    );
    return { round, rows: new Map(rows.map((r) => [r.teamId, r])) };
  });
}

export function seasonArc(
  competitionId: string,
  season: string,
  teamIds: string[],
  matches: Match[],
  teamId: string,
): ArcPoint[] {
  const finished = matches.filter((m) => m.status === "finished" && m.score);
  const out: ArcPoint[] = [];
  for (const { round, rows } of replaySeason(competitionId, season, teamIds, matches)) {
    const row = rows.get(teamId);
    // Before a club's first match everybody is level and a "position" is only
    // the order the clubs happened to arrive in. The line starts when they do.
    if (!row || row.played === 0) continue;
    const own = finished.find(
      (m) => m.round === round && (m.homeTeamId === teamId || m.awayTeamId === teamId),
    );
    out.push({
      round,
      position: row.position,
      points: row.points,
      played: row.played,
      result: own ? resultOf(own, teamId) : null,
      matchId: own?.id ?? null,
    });
  }
  return out;
}

/** The highest and lowest the club has stood, and where they stand now. */
export function arcExtremes(points: ArcPoint[]): {
  best: number;
  worst: number;
  now: number;
} | null {
  if (points.length === 0) return null;
  return {
    best: Math.min(...points.map((p) => p.position)),
    worst: Math.max(...points.map((p) => p.position)),
    now: points[points.length - 1].position,
  };
}
