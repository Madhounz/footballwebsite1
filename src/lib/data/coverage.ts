import { getRepository } from ".";
import type { Competition } from "../types";

/**
 * What the site actually has, asked rather than remembered.
 *
 * The about page used to be a list of claims kept up to date by hand, which
 * means a list of claims that goes wrong quietly: it still said six
 * competitions when there were eleven, still promised the Europa League as
 * something coming, still said goal scorers were not available after the
 * scorer charts had been live for weeks. Copy that describes a product cannot
 * be maintained separately from the product.
 *
 * So every factual sentence on that page is built from this, and this is
 * three counts against the database. The day a provider starts serving
 * line-ups, the page says so without anybody editing it — and the day one
 * stops, it stops claiming them.
 */
export interface Coverage {
  competitions: Competition[];
  /** Somebody's starting XI is in the database. */
  lineups: boolean;
  /** Goals, cards and substitutions inside a match. */
  matchEvents: boolean;
  /** The competition scorer charts, from the provider or counted here. */
  scorers: "provider" | "matches" | "none";
  /** How often today's matches are re-read, in minutes. */
  refreshMinutes: number;
}

/**
 * The live refresh is an external cron hitting `/api/sync` every minute; the
 * scheduled workflow behind it is only a backstop for that cron being down.
 * One number, here, so the page and the pipeline cannot disagree about it.
 */
export const REFRESH_MINUTES = 1;

export async function siteCoverage(): Promise<Coverage> {
  const repo = await getRepository();
  const competitions = await repo.listCompetitions();
  const [lineups, matchEvents, chart] = await Promise.all([
    repo.holdsLineups(),
    repo.holdsMatchEvents(),
    competitions[0]
      ? repo.getTopScorers(competitions[0].id, 1)
      : Promise.resolve({ rows: [], source: "matches" as const }),
  ]);
  return {
    competitions,
    lineups,
    matchEvents,
    scorers: chart.rows.length === 0 ? "none" : chart.source,
    refreshMinutes: REFRESH_MINUTES,
  };
}
