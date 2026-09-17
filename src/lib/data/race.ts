import type { Match } from "../types";
import { replaySeason } from "./season-arc";

/**
 * A whole competition's season, as lines.
 *
 * The table on the front of a league page is a photograph taken tonight. This
 * is the film: every club's place after every round, so a season reads as the
 * thing it actually was — who led in September, who came through the winter,
 * who fell out of it and when.
 *
 * It is the same replay one club's page draws its own line from, so the race
 * and the arc can never disagree, and both agree with the table because all
 * three are the same function over the same scorelines. Nothing here is
 * predicted, weighted or smoothed: every point is a table that once existed.
 */
export interface RacePoint {
  round: number;
  position: number;
  points: number;
  played: number;
}

export interface RaceLine {
  teamId: string;
  points: RacePoint[];
  /** Where they stand at the end of the replay — the table as it is now. */
  current: number;
}

export interface Race {
  rounds: number[];
  lines: RaceLine[];
  places: number;
}

export function race(
  competitionId: string,
  season: string,
  teamIds: string[],
  matches: Match[],
): Race {
  const tables = replaySeason(competitionId, season, teamIds, matches);
  const lines: RaceLine[] = [];
  for (const teamId of teamIds) {
    const points: RacePoint[] = [];
    for (const { round, rows } of tables) {
      const row = rows.get(teamId);
      // A club's line starts at their first match, not at the league's: before
      // it they are only level with everyone else in an order nobody played for.
      if (!row || row.played === 0) continue;
      points.push({ round, position: row.position, points: row.points, played: row.played });
    }
    if (points.length > 0)
      lines.push({ teamId, points, current: points[points.length - 1].position });
  }
  return {
    rounds: tables.map((t) => t.round),
    lines: lines.sort((a, b) => a.current - b.current),
    places: Math.max(
      teamIds.length,
      ...lines.map((l) => Math.max(...l.points.map((p) => p.position))),
    ),
  };
}

export interface Mover {
  teamId: string;
  from: number;
  to: number;
  /** Places gained. Negative is a fall. */
  change: number;
}

/**
 * Who has moved, over the last few rounds.
 *
 * A table says who is top and the race draws everything at once; this is the
 * sentence in between — the two or three clubs whose season changed direction
 * recently, which is what a reader scanning twenty lines is hunting for.
 *
 * A club with fewer rounds behind them than the window is measured from their
 * first: a newcomer to the table has still moved, and pretending otherwise
 * would quietly leave them out.
 */
export function movers(race: Race, window = 5, limit = 3): { up: Mover[]; down: Mover[] } {
  const moved: Mover[] = [];
  for (const line of race.lines) {
    if (line.points.length < 2) continue;
    const to = line.points[line.points.length - 1];
    const from = line.points[Math.max(0, line.points.length - 1 - window)];
    if (from.round === to.round) continue;
    const change = from.position - to.position;
    if (change !== 0)
      moved.push({ teamId: line.teamId, from: from.position, to: to.position, change });
  }
  return {
    up: moved
      .filter((m) => m.change > 0)
      .sort((a, b) => b.change - a.change || a.to - b.to)
      .slice(0, limit),
    down: moved
      .filter((m) => m.change < 0)
      .sort((a, b) => a.change - b.change || a.to - b.to)
      .slice(0, limit),
  };
}
