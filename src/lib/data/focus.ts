import type { Competition, MatchView } from "../types";

/**
 * Which competitions a day's front page leads with.
 *
 * With five competitions the answer was "all of them". With eleven it is not:
 * a rail of eleven tables is a list nobody reads to the end, and each one
 * costs the standings it is built from. So the page picks — and the rule is
 * the one a reader would use themselves. A competition playing on the day
 * being shown comes first; the rest fill whatever room is left in the site's
 * own order, which is why the Premier League is still there on a Tuesday.
 *
 * What is picked is chosen by relevance and then *shown* in the ordinary
 * order, so the rail never reshuffles itself under somebody halfway down it.
 * Nothing is hidden by this: the full day's fixtures are always listed, and
 * everything else is one tap away on the leagues page.
 */
export interface Focus {
  /** Led with, in the site's usual order. */
  shown: Competition[];
  /** Everything else, also in order — never empty-handed, just not on the page. */
  rest: Competition[];
}

export function competitionFocus(
  competitions: Competition[],
  views: Pick<MatchView, "competition">[],
  limit = 6,
): Focus {
  const byOrder = [...competitions].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const room = Math.max(0, limit);
  if (byOrder.length <= room) return { shown: byOrder, rest: [] };

  const playing = new Set(views.map((v) => v.competition.id));
  // A stable sort on one key: playing today, then everything as it was.
  const ranked = [...byOrder].sort((a, b) => Number(playing.has(b.id)) - Number(playing.has(a.id)));
  const chosen = new Set(ranked.slice(0, room).map((c) => c.id));
  return {
    shown: byOrder.filter((c) => chosen.has(c.id)),
    rest: byOrder.filter((c) => !chosen.has(c.id)),
  };
}
