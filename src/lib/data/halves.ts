import type { Match, Score, Standings } from "../types";
import { computeStandings } from "./standings";

/**
 * The season, split at half-time.
 *
 * Every match we hold carries two scorelines: the one at the break and the one
 * at the end. The site has been showing the first as a single pill on a match
 * page and throwing the arithmetic away, when subtracting one from the other
 * gives the second forty-five minutes of every match ever played here — and
 * with it a whole second season nobody has a table for.
 *
 * It answers what a league table structurally cannot be asked. Ninth is ninth;
 * ninth while being second after the break is a different club having a
 * different season, and the only place to see that is here.
 *
 * Nothing is modelled. A half is a subtraction.
 */
export type Half = "first" | "second";

export function halfScore(m: Match, half: Half): Score | null {
  if (m.status !== "finished" || !m.score || !m.halfTimeScore) return null;
  if (half === "first") return m.halfTimeScore;
  const home = m.score.home - m.halfTimeScore.home;
  const away = m.score.away - m.halfTimeScore.away;
  // A second half cannot un-score a goal. If the two scorelines disagree the
  // match is left out rather than counted as a negative one.
  if (home < 0 || away < 0) return null;
  return { home, away };
}

/**
 * A league table of one half of every match.
 *
 * Built by handing the ordinary table function a season whose scorelines are
 * halves, so the points, goal difference and tie-breaks are the ones the real
 * table uses — nothing here has its own idea of what a win is worth.
 *
 * Movement is stripped for the same reason the home and away tables strip it:
 * there is no previous round to have climbed from in a table of half-matches.
 */
export function halfTable(
  competitionId: string,
  season: string,
  teamIds: string[],
  matches: Match[],
  half: Half,
): Standings {
  const halves = matches.flatMap((m) => {
    const score = halfScore(m, half);
    return score ? [{ ...m, score }] : [];
  });
  const table = computeStandings(competitionId, season, teamIds, halves);
  return { ...table, rows: table.rows.map((r) => ({ ...r, movement: 0 })) };
}

/** Points a result is worth, from one side's point of view. */
function pointsFor(score: Score, home: boolean): number {
  const [own, other] = home ? [score.home, score.away] : [score.away, score.home];
  return own > other ? 3 : own === other ? 1 : 0;
}

export interface Turnaround {
  teamId: string;
  /** Points more than the club would have had if matches ended at half-time. */
  gained: number;
  /** Points fewer. */
  dropped: number;
  net: number;
  /** The matches behind each, most recent first, so the claim can be checked. */
  comebacks: string[];
  collapses: string[];
}

/**
 * What the second half is worth to each club, in points.
 *
 * Every finished match is played twice: once as it stood at the break, once as
 * it finished. The difference between the points those two scorelines are
 * worth is what a club won or threw away after half-time — the number behind
 * "they're a second-half team", which is said about every club and checked
 * about none.
 */
export function turnarounds(matches: Match[], teamIds: string[]): Turnaround[] {
  const out = new Map<string, Turnaround>(
    teamIds.map((teamId) => [
      teamId,
      { teamId, gained: 0, dropped: 0, net: 0, comebacks: [], collapses: [] },
    ]),
  );
  const played = matches
    .filter((m) => m.status === "finished" && m.score && m.halfTimeScore)
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff));
  for (const m of played) {
    for (const [teamId, home] of [
      [m.homeTeamId, true],
      [m.awayTeamId, false],
    ] as const) {
      const row = out.get(teamId);
      if (!row) continue;
      const change = pointsFor(m.score!, home) - pointsFor(m.halfTimeScore!, home);
      if (change > 0) {
        row.gained += change;
        row.comebacks.push(m.id);
      } else if (change < 0) {
        row.dropped -= change;
        row.collapses.push(m.id);
      }
      row.net = row.gained - row.dropped;
    }
  }
  return [...out.values()];
}
