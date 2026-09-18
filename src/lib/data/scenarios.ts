import { computeStandings } from "./standings";
import { dateOf, type ISODate } from "../dates";
import type { Match, MatchView } from "../types";

/**
 * The table under a different set of results.
 *
 * Everything on this site that answers "what changed" or "what is at stake"
 * is the same question asked twice: where does the table put everybody with
 * these results, and where with those? Because the table is computed from
 * matches rather than stored, asking it is free — swap the result of one
 * match, or drop the ones that have happened since you last looked, and
 * recompute.
 *
 * Nothing here predicts anything. A scenario is stated as a condition and its
 * arithmetic consequence — "a win puts them 1st" is true of the table as it
 * stands, and the page says so. What other clubs do that day is not modelled,
 * because it is not knowable.
 */
export type Outcome = "home" | "draw" | "away";

/** Where a set of results leaves everybody. */
export function positionsFrom(
  competitionId: string,
  season: string,
  teamIds: string[],
  matches: Match[],
): Map<string, number> {
  const table = computeStandings(competitionId, season, teamIds, matches);
  return new Map(table.rows.map((r) => [r.teamId, r.position]));
}

/**
 * Where this match would leave the two clubs in it, for each of the three
 * things that can happen. The scoreline is invented — 1–0, 0–0, 0–1 — but only
 * the points matter to a position, and goal difference moves by one either way
 * exactly as it would in a real 1–0.
 */
export interface Stake {
  outcome: Outcome;
  home: number;
  away: number;
}

export function stakes(view: MatchView, seasonMatches: Match[], teamIds: string[]): Stake[] {
  const { match, competition } = view;
  if (match.status === "finished") return [];
  const others = seasonMatches.filter((m) => m.id !== match.id);
  const score = (outcome: Outcome) =>
    outcome === "home"
      ? { home: 1, away: 0 }
      : outcome === "away"
        ? { home: 0, away: 1 }
        : { home: 0, away: 0 };
  return (["home", "draw", "away"] as const).map((outcome) => {
    const played: Match = { ...match, status: "finished", score: score(outcome) };
    const table = positionsFrom(competition.id, match.season, teamIds, [...others, played]);
    return {
      outcome,
      home: table.get(match.homeTeamId) ?? 0,
      away: table.get(match.awayTeamId) ?? 0,
    };
  });
}

/**
 * How many minutes after kick-off a match is safely over.
 *
 * We are not told when a match finished, only that it did, so "finished while
 * you were away" is worked out from the kick-off plus the longest a match
 * reasonably runs. Generous on purpose: counting a match twice is a smaller
 * sin than telling somebody they missed nothing when they missed a final.
 */
export const FULL_MATCH_MIN = 130;

function endedAt(m: Match): number {
  return new Date(m.kickoff).getTime() + FULL_MATCH_MIN * 60_000;
}

/** Whether this match finished after the reader last looked. */
export function finishedSince(m: Match, since: Date): boolean {
  return m.status === "finished" && !!m.score && endedAt(m) > since.getTime();
}

export interface Move {
  teamId: string;
  from: number;
  to: number;
}

/**
 * Where the table had everybody when the reader last looked, against where it
 * has them now. The "before" table is the same computation with the matches
 * that finished since then taken out — not a stored snapshot, so it cannot
 * drift from the table on the page.
 */
export function movementSince(
  competitionId: string,
  season: string,
  teamIds: string[],
  matches: Match[],
  since: Date,
): Move[] {
  const fresh = matches.filter((m) => finishedSince(m, since));
  if (fresh.length === 0) return [];
  const before = positionsFrom(
    competitionId,
    season,
    teamIds,
    matches.filter((m) => !finishedSince(m, since)),
  );
  const after = positionsFrom(competitionId, season, teamIds, matches);
  const moves: Move[] = [];
  for (const [teamId, to] of after) {
    const from = before.get(teamId);
    if (from !== undefined && from !== to) moves.push({ teamId, from, to });
  }
  // Biggest climb first, then the biggest fall — the two ends of the story.
  return moves.sort((a, b) => b.from - b.to - (a.from - a.to));
}

/** A day the reader has not seen yet, for asking the repository about it. */
export function daysSince(since: Date, now: Date = new Date()): ISODate[] {
  const out: ISODate[] = [];
  const day = 86_400_000;
  const first = new Date(since.getTime() - FULL_MATCH_MIN * 60_000);
  for (let t = first.getTime(); t <= now.getTime() + day; t += day) {
    const iso = dateOf(new Date(t).toISOString());
    if (!out.includes(iso)) out.push(iso);
  }
  const today = dateOf(now.toISOString());
  if (!out.includes(today)) out.push(today);
  return out;
}
