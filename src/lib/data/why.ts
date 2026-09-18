import type { HeadToHead, TeamContext } from "./match-context";
import type { Stake } from "./scenarios";

/**
 * Why this match matters, in three lines or fewer.
 *
 * Above a fixture, the useful thing is not a preview and not a prediction: it
 * is what is actually riding on it. A win puts them top. A draw leaves them
 * where they are. They have not won here in four attempts. Every one of those
 * is arithmetic on results we already hold, and every one is a fact rather
 * than an opinion — which is the only kind of sentence this site is willing to
 * put above a match nobody has played yet.
 *
 * Three at most, strongest first, and none at all rather than filler. A line
 * that says "both teams will want to win this one" is what this exists to
 * avoid.
 */
export type Why =
  | { kind: "climb"; outcome: "home" | "away"; team: "home" | "away"; to: number }
  | { kind: "hold"; team: "home" | "away"; at: number }
  | { kind: "gap"; team: "home" | "away"; places: number }
  | { kind: "h2hRun"; team: "home" | "away"; played: number }
  | { kind: "streak"; team: "home" | "away"; count: number; won: boolean };

export interface WhyInput {
  stakes: Stake[];
  home: TeamContext;
  away: TeamContext;
  h2h: HeadToHead;
  /** How many places the table has, so "top" means the top of this one. */
  places: number;
}

const LIMIT = 3;

export function whyItMatters({ stakes, home, away, h2h }: WhyInput): Why[] {
  const out: Why[] = [];
  const now = { home: home.row?.position, away: away.row?.position };
  const win = stakes.find((s) => s.outcome === "home");
  const draw = stakes.find((s) => s.outcome === "draw");
  const loss = stakes.find((s) => s.outcome === "away");

  // The biggest thing a result can do: move a club to a better place than it
  // holds now. Reported for whichever club stands to gain the most.
  const climbs: { team: "home" | "away"; outcome: "home" | "away"; to: number; gain: number }[] =
    [];
  if (win && now.home !== undefined && win.home < now.home)
    climbs.push({ team: "home", outcome: "home", to: win.home, gain: now.home - win.home });
  if (loss && now.away !== undefined && loss.away < now.away)
    climbs.push({ team: "away", outcome: "away", to: loss.away, gain: now.away - loss.away });
  climbs.sort((a, b) => a.to - b.to || b.gain - a.gain);
  for (const c of climbs.slice(0, 2)) {
    out.push({ kind: "climb", outcome: c.outcome, team: c.team, to: c.to });
  }

  // What a draw settles. Only worth saying where it changes nothing for the
  // club a win would have moved — that is the tension.
  if (draw && climbs[0]) {
    const at = climbs[0].team === "home" ? draw.home : draw.away;
    if (at === (climbs[0].team === "home" ? now.home : now.away)) {
      out.push({ kind: "hold", team: climbs[0].team, at });
    }
  }

  // A meeting of two clubs a long way apart is its own story.
  if (out.length < LIMIT && now.home !== undefined && now.away !== undefined) {
    const gap = Math.abs(now.home - now.away);
    if (gap >= 8) {
      out.push({ kind: "gap", team: now.home > now.away ? "home" : "away", places: gap });
    }
  }

  // Their record against each other, when there is one and it is one-sided.
  if (out.length < LIMIT && h2h.played >= 3) {
    if (h2h.homeWins === 0) out.push({ kind: "h2hRun", team: "away", played: h2h.played });
    else if (h2h.awayWins === 0) out.push({ kind: "h2hRun", team: "home", played: h2h.played });
  }

  // A run either club is carrying into it.
  if (out.length < LIMIT) {
    const runs = [
      { team: "home" as const, streak: home.streak },
      { team: "away" as const, streak: away.streak },
    ]
      .filter(
        (r) =>
          r.streak &&
          r.streak.count >= 3 &&
          (r.streak.kind === "W" || r.streak.kind === "unbeaten"),
      )
      .sort((a, b) => (b.streak?.count ?? 0) - (a.streak?.count ?? 0));
    const best = runs[0];
    if (best?.streak) {
      out.push({
        kind: "streak",
        team: best.team,
        count: best.streak.count,
        won: best.streak.kind === "W",
      });
    }
  }

  return out.slice(0, LIMIT);
}
