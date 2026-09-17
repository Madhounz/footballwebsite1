import type { Competition, MatchView } from "../types";

/**
 * Which competitions a day's front page leads with.
 *
 * With five competitions the answer was "all of them". With eleven it is not:
 * a rail of eleven tables is a list nobody reads to the end, and each one
 * costs the standings it is built from. So the page picks.
 *
 * Playing today matters, but it does not settle it. Being on tonight moves a
 * competition up a few places; it does not make it the biggest competition in
 * the world for a day. A second division playing on a Tuesday is still a
 * second division, and it should not take the Premier League's place on the
 * page because the Premier League happens to be resting. So the rule is a
 * promotion rather than a jump to the front: `order` — the order the site
 * itself lists competitions in — decides, and today's fixtures are worth
 * `PROMOTION` places of it.
 *
 * What is picked is then *shown* in the ordinary order, so the rail never
 * reshuffles itself under somebody halfway down it. Nothing is hidden by
 * this: the full day's fixtures are always listed, and everything else is one
 * tap away on the leagues page.
 */
export interface Focus {
  /** Led with, in the site's usual order. */
  shown: Competition[];
  /** Everything else, also in order — never empty-handed, just not on the page. */
  rest: Competition[];
}

/**
 * How many places being on today is worth. Four is enough to pull the
 * Champions League up on a Tuesday and the Europa League on a Thursday,
 * without letting the tenth competition on the list outrank the second.
 */
const PROMOTION = 4;

export function competitionFocus(
  competitions: Competition[],
  views: Pick<MatchView, "competition">[],
  limit = 6,
): Focus {
  const byOrder = [...competitions].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const room = Math.max(0, limit);
  if (byOrder.length <= room) return { shown: byOrder, rest: [] };

  const playing = new Set(views.map((v) => v.competition.id));
  const rank = (c: Competition) => c.order - (playing.has(c.id) ? PROMOTION : 0);
  const ranked = [...byOrder].sort((a, b) => rank(a) - rank(b) || a.order - b.order);
  const chosen = new Set(ranked.slice(0, room).map((c) => c.id));
  return {
    shown: byOrder.filter((c) => chosen.has(c.id)),
    rest: byOrder.filter((c) => !chosen.has(c.id)),
  };
}
