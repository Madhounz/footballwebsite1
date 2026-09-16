import type { HonourEntry, Honours } from "../types";

/**
 * Keeping `data/honours/*.json` current from the provider.
 *
 * Historical winners are curated data — a reviewer should be able to read the
 * diff when a season is added — but who won last season is a fact, and a fact
 * is not ours to type from memory. football-data names the winner of every
 * season it knows about, so the season that just ended arrives the same way a
 * scoreline does: from a source, deterministically.
 *
 * Two rules keep the curation intact:
 *   - an entry we already have is never overwritten. Ours carries the runner-up
 *     and the note; theirs carries a name. A disagreement is reported for a
 *     person to settle, not silently resolved.
 *   - `mostTitles` counts every title a club has ever won, which is more
 *     seasons than these files list, so a new entry increments the tally
 *     rather than recomputing it.
 */

export interface ProviderSeason {
  startDate: string;
  endDate: string;
  winner: { id: number; name: string; shortName?: string | null; tla?: string | null } | null;
}

/** "2025-08-15" to "2026-05-24" is the 2025/26 season; a summer tournament keeps its year. */
export function seasonLabel(startDate: string, endDate: string): string {
  const from = startDate.slice(0, 4);
  const to = endDate.slice(0, 4);
  return from === to ? from : `${from}/${to.slice(2)}`;
}

export interface WinnerRow {
  season: string;
  entry: HonourEntry;
}

/**
 * Provider seasons to honour entries. A season still being played has no
 * winner and is skipped; so is one whose club we cannot name.
 */
export function entriesFromSeasons(
  seasons: ProviderSeason[],
  resolve: (name: string) => { id: string; name: string } | null,
): WinnerRow[] {
  const rows: WinnerRow[] = [];
  for (const s of seasons) {
    if (!s.winner || !s.startDate || !s.endDate) continue;
    const season = seasonLabel(s.startDate, s.endDate);
    const ours =
      resolve(s.winner.name) ?? (s.winner.shortName ? resolve(s.winner.shortName) : null);
    rows.push({
      season,
      entry: {
        season,
        winner: ours?.name ?? s.winner.shortName ?? s.winner.name,
        ...(ours ? { winnerTeamId: ours.id } : {}),
      },
    });
  }
  return rows;
}

export interface MergeResult {
  honours: Honours;
  /** Seasons written for the first time. */
  added: string[];
  /** Seasons where the provider names a different winner than the file does. */
  conflicts: { season: string; ours: string; theirs: string }[];
  /** Seasons older than the file's own history, left out unless asked for. */
  skippedOlder: string[];
}

export function mergeHonours(
  honours: Honours,
  rows: WinnerRow[],
  { includeOlder = false }: { includeOlder?: boolean } = {},
): MergeResult {
  const bySeason = new Map(honours.entries.map((e) => [e.season, e]));
  const oldest = honours.entries.reduce<string | null>(
    (min, e) => (min === null || e.season < min ? e.season : min),
    null,
  );
  const added: string[] = [];
  const conflicts: MergeResult["conflicts"] = [];
  const skippedOlder: string[] = [];
  let mostTitles = honours.mostTitles;

  for (const { season, entry } of rows) {
    const existing = bySeason.get(season);
    if (existing) {
      const ours = existing.winnerTeamId ?? existing.winner;
      const theirs = entry.winnerTeamId ?? entry.winner;
      if (ours !== theirs) conflicts.push({ season, ours: existing.winner, theirs: entry.winner });
      continue;
    }
    if (!includeOlder && oldest !== null && season < oldest) {
      skippedOlder.push(season);
      continue;
    }
    bySeason.set(season, entry);
    mostTitles = addTitle(mostTitles, entry);
    added.push(season);
  }

  const entries = [...bySeason.values()].sort((a, b) => b.season.localeCompare(a.season));
  return { honours: { ...honours, entries, mostTitles }, added, conflicts, skippedOlder };
}

/** One more title for the winner, keeping the table in descending order. */
export function addTitle(
  mostTitles: Honours["mostTitles"],
  entry: HonourEntry,
): Honours["mostTitles"] {
  const match = (t: Honours["mostTitles"][number]) =>
    entry.winnerTeamId ? t.teamId === entry.winnerTeamId : t.team === entry.winner;
  const next = mostTitles.some(match)
    ? mostTitles.map((t) => (match(t) ? { ...t, count: t.count + 1 } : t))
    : [
        ...mostTitles,
        {
          team: entry.winner,
          count: 1,
          ...(entry.winnerTeamId ? { teamId: entry.winnerTeamId } : {}),
        },
      ];
  return next.sort((a, b) => b.count - a.count || a.team.localeCompare(b.team));
}
