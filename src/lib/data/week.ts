import { type ISODate } from "../dates";
import type { MatchView } from "../types";

/**
 * The last seven days, across everything.
 *
 * A results page answers "what happened in the Premier League on Saturday".
 * Nobody watches one league, and nobody reads eleven results pages. What is
 * missing is the thing a Monday morning conversation is made of: the game that
 * turned round after half time, the one that finished 5–4, the side sixteenth
 * in the table who beat the side second.
 *
 * Every one of those is arithmetic on a scoreline, which is the only thing a
 * free plan gives us for every match — so unlike a highlights page this is
 * complete. Nothing is selected by taste: the sections are sorted by a number,
 * the number is shown beside each match, and a reader who disagrees can see
 * exactly what the sorting was.
 */
export interface WeekPick {
  view: MatchView;
  /** What put it in this list: goals, margin, or places in the table. */
  value: number;
}

export interface WeekDay {
  date: ISODate;
  matches: number;
  goals: number;
}

export interface WeekReport {
  from: ISODate;
  to: ISODate;
  played: number;
  goals: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  /** Teams that conceded nothing — two of them in a goalless draw. */
  cleanSheets: number;
  goalless: number;
  byDay: WeekDay[];
  /** Behind at half time, in front at the end. */
  comebacks: WeekPick[];
  /** Won by three or more. */
  thrashings: WeekPick[];
  /** Five goals or more between them. */
  thrillers: WeekPick[];
  /** Beaten by a club below them in the table; the biggest gaps first. */
  upsets: WeekPick[];
}

const THRASHING = 3;
const THRILLER = 5;
/**
 * How far below its opponent a winner has to be to count as an upset.
 *
 * Low on purpose. The number is printed on every row — "+11 places" — so the
 * reader does the judging, and a floor high enough to be unarguable empties
 * the section in any week where the table behaved itself. Three places is the
 * point below which a result is not worth calling anything at all.
 */
const UPSET = 3;

/** Sorted by `value`, biggest first, and settled by kick-off so it never wobbles. */
function top(picks: WeekPick[], limit: number): WeekPick[] {
  return [...picks]
    .sort((a, b) => b.value - a.value || a.view.match.kickoff.localeCompare(b.view.match.kickoff))
    .slice(0, limit);
}

export function weekReport(
  days: { date: ISODate; views: MatchView[] }[],
  /** Current table places, by competition then club. Cup ties are in here too. */
  places: Map<string, Map<string, number>>,
  limit = 3,
): WeekReport {
  const byDay: WeekDay[] = [];
  const comebacks: WeekPick[] = [];
  const thrashings: WeekPick[] = [];
  const thrillers: WeekPick[] = [];
  const upsets: WeekPick[] = [];
  let played = 0;
  let goals = 0;
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let cleanSheets = 0;
  let goalless = 0;

  for (const day of days) {
    let dayMatches = 0;
    let dayGoals = 0;
    for (const view of day.views) {
      const m = view.match;
      if (m.status !== "finished" || !m.score) continue;
      const { home, away } = m.score;
      played++;
      dayMatches++;
      dayGoals += home + away;
      goals += home + away;
      if (home > away) homeWins++;
      else if (home < away) awayWins++;
      else draws++;
      if (away === 0) cleanSheets++;
      if (home === 0) cleanSheets++;
      if (home === 0 && away === 0) goalless++;

      const margin = Math.abs(home - away);
      if (margin >= THRASHING) thrashings.push({ view, value: margin });
      if (home + away >= THRILLER) thrillers.push({ view, value: home + away });

      // Behind at the break, in front at the end. The half-time score is
      // stored for every match, so this needs no event feed.
      const ht = m.halfTimeScore;
      if (ht && margin > 0) {
        const wonAtHome = home > away;
        const behindAtHalf = wonAtHome ? ht.home < ht.away : ht.away < ht.home;
        if (behindAtHalf) {
          comebacks.push({ view, value: Math.abs(ht.home - ht.away) });
        }
      }

      // The winner's place against the loser's, in the table they share. A
      // cup tie between clubs from leagues we hold separately has no shared
      // table, and is not an upset we can measure.
      const table = places.get(view.competition.id);
      const winner = home > away ? view.home.id : home < away ? view.away.id : null;
      const loser = winner === null ? null : winner === view.home.id ? view.away.id : view.home.id;
      if (table && winner && loser) {
        const w = table.get(winner);
        const l = table.get(loser);
        if (w !== undefined && l !== undefined && w - l >= UPSET) {
          upsets.push({ view, value: w - l });
        }
      }
    }
    byDay.push({ date: day.date, matches: dayMatches, goals: dayGoals });
  }

  return {
    from: days[0]?.date ?? ("" as ISODate),
    to: days[days.length - 1]?.date ?? ("" as ISODate),
    played,
    goals,
    homeWins,
    draws,
    awayWins,
    cleanSheets,
    goalless,
    byDay,
    comebacks: top(comebacks, limit),
    thrashings: top(thrashings, limit),
    thrillers: top(thrillers, limit),
    upsets: top(upsets, limit),
  };
}

/** Goals per match to one decimal, or null with nothing played. */
export function goalsPerMatch(report: Pick<WeekReport, "played" | "goals">): number | null {
  return report.played > 0 ? Math.round((report.goals / report.played) * 10) / 10 : null;
}
