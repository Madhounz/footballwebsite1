import type { MatchView } from "../types";

/**
 * A season as a square: every club against every other, home down the side.
 *
 * A results list is chronological, which is how a season is lived and a poor
 * way to see it whole. The grid is the other view — the one that shows a club
 * taking points off everyone below them and none off anyone above, a row that
 * is green until March, the one column nobody has scored in. Every cell is a
 * result that happened, and every empty cell is a match still to come.
 *
 * It only makes sense where everybody plays everybody: a league. A group or a
 * knockout leaves a square almost entirely blank, which says nothing at all.
 */
export interface GridCell {
  home: number;
  away: number;
  slug: string;
  /** From the home club's point of view, because the home club owns the row. */
  result: "W" | "D" | "L";
}

export interface ResultsGrid {
  /** Club ids in table order, used for both the rows and the columns. */
  teamIds: string[];
  /** Keyed `home:away`. */
  cells: Map<string, GridCell>;
  played: number;
}

export function resultsGrid(views: MatchView[], teamIds: string[]): ResultsGrid {
  const present = new Set(teamIds);
  const cells = new Map<string, GridCell>();
  for (const v of views) {
    const { match: m, home, away } = v;
    if (m.status !== "finished" || !m.score) continue;
    if (!present.has(home.id) || !present.has(away.id) || home.id === away.id) continue;
    const key = `${home.id}:${away.id}`;
    // A league plays each pairing once each way. If a competition somehow
    // offers two, the later one is the one a reader means.
    const existing = cells.get(key);
    if (existing && existing.slug >= m.slug) continue;
    cells.set(key, {
      home: m.score.home,
      away: m.score.away,
      slug: m.slug,
      result: m.score.home > m.score.away ? "W" : m.score.home < m.score.away ? "L" : "D",
    });
  }
  return { teamIds, cells, played: cells.size };
}
