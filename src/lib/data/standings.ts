import type { FormResult, Match, MatchEvent, ScorerRow, StandingRow, Standings } from "../types";

interface Acc {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  results: { round: number; kickoff: string; result: FormResult }[];
}

/**
 * Builds a league table from finished matches. Tie-breakers: points, goal
 * difference, goals scored, then name order supplied by `teamOrder` (stable).
 * Used identically by the demo and database repositories, so a table is always
 * derived from results rather than trusted from a single provider.
 */
export function computeStandings(
  competitionId: string,
  season: string,
  teamIds: string[],
  matches: Match[],
  updatedAt: string = new Date().toISOString(),
): Standings {
  const rows = tableFor(teamIds, matches);
  const previous = tableFor(
    teamIds,
    matches.filter((m) => m.round < currentRound(matches)),
  );
  const prevPos = new Map(previous.map((r) => [r.teamId, r.position]));
  for (const r of rows) {
    const before = prevPos.get(r.teamId) ?? r.position;
    r.movement = before - r.position;
  }
  return { competitionId, season, updatedAt, rows };
}

function currentRound(matches: Match[]): number {
  let max = 0;
  for (const m of matches) if (m.status === "finished" && m.round > max) max = m.round;
  return max;
}

function tableFor(teamIds: string[], matches: Match[]): StandingRow[] {
  const acc = new Map<string, Acc>(
    teamIds.map((id) => [
      id,
      {
        teamId: id,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
        results: [],
      },
    ]),
  );
  for (const m of matches) {
    if (m.status !== "finished" || !m.score) continue;
    const h = acc.get(m.homeTeamId);
    const a = acc.get(m.awayTeamId);
    if (!h || !a) continue;
    apply(h, m.score.home, m.score.away, m);
    apply(a, m.score.away, m.score.home, m);
  }
  const order = new Map(teamIds.map((id, i) => [id, i]));
  const rows = [...acc.values()].sort((x, y) => {
    const gdX = x.goalsFor - x.goalsAgainst;
    const gdY = y.goalsFor - y.goalsAgainst;
    return (
      y.points - x.points ||
      gdY - gdX ||
      y.goalsFor - x.goalsFor ||
      (order.get(x.teamId) ?? 0) - (order.get(y.teamId) ?? 0)
    );
  });
  return rows.map((r, i) => ({
    position: i + 1,
    teamId: r.teamId,
    played: r.played,
    won: r.won,
    drawn: r.drawn,
    lost: r.lost,
    goalsFor: r.goalsFor,
    goalsAgainst: r.goalsAgainst,
    goalDifference: r.goalsFor - r.goalsAgainst,
    points: r.points,
    form: r.results
      .sort((p, q) => p.kickoff.localeCompare(q.kickoff))
      .slice(-5)
      .map((x) => x.result),
    movement: 0,
  }));
}

function apply(t: Acc, gf: number, ga: number, m: Match) {
  t.played++;
  t.goalsFor += gf;
  t.goalsAgainst += ga;
  let result: FormResult;
  if (gf > ga) {
    t.won++;
    t.points += 3;
    result = "W";
  } else if (gf === ga) {
    t.drawn++;
    t.points += 1;
    result = "D";
  } else {
    t.lost++;
    result = "L";
  }
  t.results.push({ round: m.round, kickoff: m.kickoff, result });
}

/** Aggregates goals and assists per player from match events. */
export function computeScorers(
  events: MatchEvent[],
  appearances: Map<string, number>,
  limit = 20,
): ScorerRow[] {
  const rows = new Map<string, ScorerRow>();
  const get = (playerId: string, teamId: string) => {
    let r = rows.get(playerId);
    if (!r) {
      r = {
        playerId,
        teamId,
        goals: 0,
        assists: 0,
        penalties: 0,
        appearances: appearances.get(playerId) ?? 0,
      };
      rows.set(playerId, r);
    }
    return r;
  };
  for (const e of events) {
    if (!e.playerId) continue;
    if (e.type === "goal" || e.type === "penalty") {
      const r = get(e.playerId, e.teamId);
      r.goals++;
      if (e.type === "penalty") r.penalties++;
      if (e.relatedPlayerId) get(e.relatedPlayerId, e.teamId).assists++;
    }
  }
  return [...rows.values()]
    .filter((r) => r.goals > 0 || r.assists > 0)
    .sort((a, b) => b.goals - a.goals || a.penalties - b.penalties || b.assists - a.assists)
    .slice(0, limit);
}
