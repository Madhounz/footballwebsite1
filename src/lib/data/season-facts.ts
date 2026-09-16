import type { Match, MatchView, StandingRow } from "../types";

/**
 * The shape of a season so far, read off the results.
 *
 * Everything here comes from scorelines, which we hold for every match — unlike
 * goalscorers, which depend on how many detail requests we could afford. So a
 * season-facts panel can be complete in a way a scorer chart cannot, and the
 * page can state these plainly.
 */
export interface SeasonFacts {
  played: number;
  goals: number;
  /** Goals per match, to one decimal place. */
  goalsPerMatch: number;
  /** How the season's results split between the two sides and the draw. */
  outcomes: { homeWins: number; draws: number; awayWins: number };
  bestAttack: { teamId: string; goals: number } | null;
  bestDefence: { teamId: string; conceded: number } | null;
  /** The widest margin so far; ties go to the one with more goals in it. */
  biggestWin: MatchView | null;
  /** The most goals in a single match; ties go to the most recent. */
  highestScoring: MatchView | null;
  /** Matches without conceding, most first. */
  cleanSheets: { teamId: string; count: number }[];
}

const finished = (m: Match) => m.status === "finished" && m.score != null;

export function seasonFacts(views: MatchView[], table: StandingRow[]): SeasonFacts {
  const played = views.filter((v) => finished(v.match));
  const goals = played.reduce((n, v) => n + v.match.score!.home + v.match.score!.away, 0);
  const outcomes = { homeWins: 0, draws: 0, awayWins: 0 };
  const cleanSheets = new Map<string, number>();
  let biggestWin: MatchView | null = null;
  let highestScoring: MatchView | null = null;

  for (const v of played) {
    const { home: h, away: a } = v.match.score!;
    if (h > a) outcomes.homeWins++;
    else if (h === a) outcomes.draws++;
    else outcomes.awayWins++;
    if (a === 0)
      cleanSheets.set(v.match.homeTeamId, (cleanSheets.get(v.match.homeTeamId) ?? 0) + 1);
    if (h === 0)
      cleanSheets.set(v.match.awayTeamId, (cleanSheets.get(v.match.awayTeamId) ?? 0) + 1);

    const margin = Math.abs(h - a);
    const total = h + a;
    if (!biggestWin) biggestWin = v;
    else {
      const best = biggestWin.match.score!;
      const bestMargin = Math.abs(best.home - best.away);
      if (margin > bestMargin || (margin === bestMargin && total > best.home + best.away)) {
        biggestWin = v;
      }
    }
    if (!highestScoring) highestScoring = v;
    else {
      const best = highestScoring.match.score!;
      if (total >= best.home + best.away) highestScoring = v;
    }
  }

  const ranked = [...table].filter((r) => r.played > 0);
  const bestAttack = ranked.length
    ? ranked.reduce((best, r) => (r.goalsFor > best.goalsFor ? r : best))
    : null;
  const bestDefence = ranked.length
    ? ranked.reduce((best, r) => (r.goalsAgainst < best.goalsAgainst ? r : best))
    : null;

  return {
    played: played.length,
    goals,
    goalsPerMatch: played.length ? Math.round((goals / played.length) * 10) / 10 : 0,
    outcomes,
    bestAttack: bestAttack ? { teamId: bestAttack.teamId, goals: bestAttack.goalsFor } : null,
    bestDefence: bestDefence
      ? { teamId: bestDefence.teamId, conceded: bestDefence.goalsAgainst }
      : null,
    biggestWin:
      biggestWin && Math.abs(biggestWin.match.score!.home - biggestWin.match.score!.away) > 0
        ? biggestWin
        : null,
    highestScoring,
    cleanSheets: [...cleanSheets.entries()]
      .map(([teamId, count]) => ({ teamId, count }))
      .sort((a, b) => b.count - a.count || a.teamId.localeCompare(b.teamId))
      .slice(0, 3),
  };
}
