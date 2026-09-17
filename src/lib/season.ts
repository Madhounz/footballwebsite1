import type { ISODate } from "./dates";

/**
 * What season a competition is in, and when that season runs.
 *
 * Almost every league here runs July to June and is written across two years —
 * 2026/27. Brazil does not: the Brasileirão starts in the spring and finishes
 * before Christmas, so its season is one year, written 2026. Calling it
 * 2026/27 would be a wrong fact printed on every page of it, and asking a
 * provider for matches between July and June would fetch half of one season
 * and half of the next.
 *
 * The competitions that work this way are named here rather than guessed from
 * the country, because it is a fact about a competition and there are only
 * ever a handful of them.
 */
export const CALENDAR_YEAR_COMPETITIONS: ReadonlySet<string> = new Set(["brasileirao"]);

export function isCalendarYear(competitionId: string): boolean {
  return CALENDAR_YEAR_COMPETITIONS.has(competitionId);
}

/**
 * The year a provider means by "this season" — the number that goes in a
 * `season=` parameter. For a European league that is the year the season began
 * in; for a calendar-year league it is simply the year we are in.
 */
export function seasonYear(competitionId: string, today: ISODate): number {
  if (isCalendarYear(competitionId)) return Number(today.slice(0, 4));
  return europeanSeasonYear(today);
}

/** The year a July-to-June season began in: the default for everything else. */
export function europeanSeasonYear(today: ISODate): number {
  const year = Number(today.slice(0, 4));
  return today.slice(5) >= "07-01" ? year : year - 1;
}

/** How the season is written: `2026/27`, or `2026` where it is one year. */
export function seasonLabel(competitionId: string, today: ISODate): string {
  const year = seasonYear(competitionId, today);
  if (isCalendarYear(competitionId)) return String(year);
  return `${year}/${String(year + 1).slice(2)}`;
}

/** The dates the season is played between, wide enough to hold all of it. */
export function seasonWindow(
  competitionId: string,
  today: ISODate,
): { fromDate: ISODate; toDate: ISODate } {
  const year = seasonYear(competitionId, today);
  if (isCalendarYear(competitionId)) {
    return { fromDate: `${year}-01-01` as ISODate, toDate: `${year}-12-31` as ISODate };
  }
  return { fromDate: `${year}-07-01` as ISODate, toDate: `${year + 1}-06-30` as ISODate };
}

/**
 * One window covering every competition in the run. Each competition is still
 * fetched for its own season — the provider is asked for one season at a time
 * and the window only trims the answer — so a range wide enough for all of
 * them costs nothing and drops none of them.
 */
export function seasonWindowFor(
  competitionIds: readonly string[],
  today: ISODate,
): { fromDate: ISODate; toDate: ISODate } {
  const windows = competitionIds.map((id) => seasonWindow(id, today));
  if (windows.length === 0) return seasonWindow("", today);
  return {
    fromDate: windows.map((w) => w.fromDate).sort()[0],
    toDate: windows
      .map((w) => w.toDate)
      .sort()
      .at(-1)!,
  };
}
