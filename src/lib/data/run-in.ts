import type { Match, StandingRow, TableZone } from "../types";

/**
 * What is left of the season, and what the table can still do.
 *
 * A league table says where everybody is. From about February the question
 * every fan is actually asking is a different one — can we still catch them,
 * are we down, is it over — and it is answered here the only way it can be
 * answered honestly: by arithmetic that cannot be wrong.
 *
 * Two claims are made, and both are proofs rather than forecasts:
 *
 *   - a club cannot finish higher than `best`, because that many clubs
 *     already hold more points than it can reach even by winning out;
 *   - it cannot finish lower than `worst`, because that many clubs cannot
 *     reach what it already has.
 *
 * Neither depends on who plays whom, so neither can be overturned by a result.
 * What is *not* claimed is the opposite: a place inside that range is "not
 * ruled out on points", which is not the same as reachable — with three points
 * for a win, deciding whether a club can truly still finish fourth is a much
 * harder question than it looks, and a site that answered it with a guess
 * would be a site that gets it wrong every May. So the range is a bound, the
 * page says so, and nothing here pretends to know more than it does.
 *
 * `pace` is the one number that is not a proof, and it is labelled as such
 * everywhere it appears: points per game so far, carried to the end of the
 * season. It is what the club is on course for, not what will happen.
 */
export interface RunInFixture {
  matchId: string;
  slug: string;
  kickoff: string;
  round: number;
  opponentId: string;
  /** True when this club is at home. */
  home: boolean;
  /** Where the opponent sits today; null for a club the table does not hold. */
  opponentPosition: number | null;
}

export interface RunInRow {
  teamId: string;
  position: number;
  played: number;
  points: number;
  /** Matches still to play in the league phase. */
  remaining: number;
  /** Points with every one of them won. */
  maxPoints: number;
  /** The highest place the table can still reach. Proven. */
  best: number;
  /** The lowest. Proven. */
  worst: number;
  /** Points per game so far, carried to the end of the season. A pace. */
  pace: number | null;
  /** Mean table place of the next few opponents; lower is harder. */
  difficulty: number | null;
  /** The next few, in kick-off order. */
  fixtures: RunInFixture[];
}

/** Whether a club can still finish inside a zone — or already cannot avoid it. */
export type ZoneVerdict = "secured" | "open" | "out";

interface Side {
  teamId: string;
  position: number;
  points: number;
  remaining: number;
  maxPoints: number;
}

/** Only the league phase: a knockout tie is not three points on the table. */
function isLeaguePhase(m: Match, rounds: number): boolean {
  return rounds <= 0 || m.round <= rounds;
}

/**
 * A match still worth points to the clubs in it. A postponed match is still
 * to be played; a cancelled one never will be.
 */
function stillToPlay(m: Match): boolean {
  return m.status === "scheduled" || m.status === "live" || m.status === "postponed";
}

export function runIn(
  rows: StandingRow[],
  matches: Match[],
  rounds: number,
  fixtures = 5,
): RunInRow[] {
  const place = new Map(rows.map((r) => [r.teamId, r.position]));
  const left = new Map<string, Match[]>(rows.map((r) => [r.teamId, []]));
  for (const m of matches) {
    if (!stillToPlay(m) || !isLeaguePhase(m, rounds)) continue;
    left.get(m.homeTeamId)?.push(m);
    left.get(m.awayTeamId)?.push(m);
  }
  for (const list of left.values()) list.sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  const sides: Side[] = rows.map((r) => {
    const remaining = left.get(r.teamId)?.length ?? 0;
    return {
      teamId: r.teamId,
      position: r.position,
      points: r.points,
      remaining,
      maxPoints: r.points + remaining * 3,
    };
  });
  const byId = new Map(sides.map((s) => [s.teamId, s]));
  const total = sides.length;

  return rows.map((r) => {
    const me = byId.get(r.teamId)!;
    let above = 0;
    let below = 0;
    for (const other of sides) {
      if (other.teamId === me.teamId) continue;
      if (mustFinishAbove(other, me)) above++;
      if (mustFinishAbove(me, other)) below++;
    }
    // The run-in is the next few, not everything left. In a league where
    // everyone plays everyone, the whole remainder averages out to mid-table
    // for all twenty clubs and says nothing; the next five is the thing fans
    // actually argue about, and it pulls apart properly.
    const mine = (left.get(r.teamId) ?? []).slice(0, fixtures);
    const opponents = mine.map((m) => (m.homeTeamId === r.teamId ? m.awayTeamId : m.homeTeamId));
    const known = opponents.map((id) => place.get(id)).filter((p): p is number => p !== undefined);
    return {
      teamId: r.teamId,
      position: r.position,
      played: r.played,
      points: r.points,
      remaining: me.remaining,
      maxPoints: me.maxPoints,
      best: 1 + above,
      worst: total - below,
      pace: r.played > 0 ? Math.round((r.points / r.played) * (r.played + me.remaining)) : null,
      difficulty: known.length > 0 ? known.reduce((a, b) => a + b, 0) / known.length : null,
      fixtures: mine.map((m) => {
        const home = m.homeTeamId === r.teamId;
        const opponentId = home ? m.awayTeamId : m.homeTeamId;
        return {
          matchId: m.id,
          slug: m.slug,
          kickoff: m.kickoff,
          round: m.round,
          opponentId,
          home,
          opponentPosition: place.get(opponentId) ?? null,
        };
      }),
    };
  });
}

/**
 * Can `x` still be caught by `y`? Once neither has a match left the table is
 * final and says so itself; until then only points can prove it, because a
 * tie on points is settled by a goal difference nobody can predict.
 */
function mustFinishAbove(x: Side, y: Side): boolean {
  if (x.remaining === 0 && y.remaining === 0) return x.position < y.position;
  return x.points > y.maxPoints;
}

export function zoneVerdict(row: Pick<RunInRow, "best" | "worst">, zone: TableZone): ZoneVerdict {
  if (row.best >= zone.from && row.worst <= zone.to) return "secured";
  if (row.worst < zone.from || row.best > zone.to) return "out";
  return "open";
}

/** True while every club could still finish anywhere: nothing to show yet. */
export function undecided(rows: RunInRow[]): boolean {
  return rows.every((r) => r.best === 1 && r.worst === rows.length);
}
