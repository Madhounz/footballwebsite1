import type { MatchView, StandingRow, Team } from "../types";
import { streakFrom } from "./match-context";

/**
 * Which of today's fixtures are worth an evening.
 *
 * A day's list is chronological, which is the right order to read it in and
 * the wrong one for deciding what to watch: fourteenth against seventeenth at
 * six o'clock sits above second against fourth at eight. Every fan does this
 * sum in their head from the table and the form guide, and we hold both.
 *
 * It is a judgement, not a fact, so it is made by arithmetic anybody can
 * check — table places, current runs, and whether the two clubs share a city —
 * and the page prints the reason beside the fixture rather than asking to be
 * trusted. No model is anywhere near it.
 */
export type Reason =
  | { kind: "derby"; city: string }
  | { kind: "top"; home: number; away: number }
  | { kind: "form"; n: number };

export interface Pick {
  view: MatchView;
  score: number;
  reason: Reason;
}

/**
 * A run of three or more, won or merely unbeaten. `form` is oldest first and a
 * run is read backwards from the last match, the same way the table reads it.
 * A winless run is a run too, and not one that sells a fixture.
 */
function runLength(form: StandingRow["form"] | undefined): number {
  if (!form || form.length === 0) return 0;
  const streak = streakFrom([...form].reverse());
  return streak && (streak.kind === "W" || streak.kind === "unbeaten") ? streak.count : 0;
}

export function worthWatching(
  views: MatchView[],
  tables: Map<string, Map<string, StandingRow>>,
  teams: Map<string, Team>,
  limit = 3,
): Pick[] {
  // How many places a competition has, read from the table rather than from
  // the two clubs in front of us: with the size taken per match, second
  // against fourth in a twenty-club league scored as though the league had
  // four clubs in it, and lost to fourteenth against seventeenth.
  const size = new Map(
    [...tables].map(([id, table]) => [
      id,
      Math.max(table.size, ...[...table.values()].map((r) => r.position)),
    ]),
  );
  const picks: Pick[] = [];
  for (const view of views) {
    const { match, home, away, competition } = view;
    if (match.status !== "scheduled" && match.status !== "live") continue;
    const table = tables.get(competition.id);
    const h = table?.get(home.id);
    const a = table?.get(away.id);
    // Without a table there is nothing to weigh: a cup tie between clubs we
    // hold no league for is not less interesting, we just cannot say why.
    if (!h || !a) continue;

    const places = Math.max(size.get(competition.id) ?? 0, h.position, a.position);
    // Both near the top carries the most weight, then how close together they
    // are — a gap of one place is a meeting, a gap of fifteen is a fixture.
    const height = (2 * places - h.position - a.position) / (2 * places);
    const closeness = 1 - Math.min(Math.abs(h.position - a.position), places) / places;
    const runs = Math.min(runLength(h.form), runLength(a.form));
    const homeCity = teams.get(home.id)?.city?.trim().toLowerCase();
    const awayCity = teams.get(away.id)?.city?.trim().toLowerCase();
    const derby = Boolean(homeCity && awayCity && homeCity === awayCity);

    const score = height * 2 + closeness + (runs >= 3 ? 0.5 : 0) + (derby ? 0.75 : 0);

    // The reason is whichever of the three actually applies, strongest first.
    const reason: Reason = derby
      ? { kind: "derby", city: teams.get(home.id)?.city ?? "" }
      : runs >= 3 && h.position > 6 && a.position > 6
        ? { kind: "form", n: runs }
        : { kind: "top", home: h.position, away: a.position };
    picks.push({ view, score, reason });
  }
  return picks
    .sort((x, y) => y.score - x.score || x.view.match.kickoff.localeCompare(y.view.match.kickoff))
    .slice(0, limit);
}
