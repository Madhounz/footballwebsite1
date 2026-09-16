import type { FormResult, MatchView, StandingRow } from "../types";

/**
 * What a match page can say about a fixture without a provider's match detail.
 *
 * Line-ups and timelines come from a metered plan that cannot cover every
 * match, and a plan can be suspended outright — which leaves a page that is
 * nothing but two crests and a kick-off time. Everything here is derived from
 * scorelines instead, which we hold for every match of the season, so it is
 * always available and costs no request at all.
 *
 * All of it is computed rather than stored, like the tables and the player
 * pages: the same rule that keeps a standing honest keeps these honest.
 */

/** Which half of a club's season to count: everything, or only home or away. */
export type Side = "all" | "home" | "away";

/** A club's record across a set of matches. */
export interface TeamRecord {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  /** Matches they did not score in. */
  blanks: number;
}

export const EMPTY_RECORD: TeamRecord = {
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  cleanSheets: 0,
  blanks: 0,
};

/** A finished match's score from one club's point of view. */
function scoreFor(v: MatchView, teamId: string): { us: number; them: number } | null {
  if (v.match.status !== "finished" || !v.match.score) return null;
  const { home, away } = v.match.score;
  if (v.home.id === teamId) return { us: home, them: away };
  if (v.away.id === teamId) return { us: away, them: home };
  return null;
}

export function resultFor(v: MatchView, teamId: string): FormResult | null {
  const s = scoreFor(v, teamId);
  if (!s) return null;
  return s.us > s.them ? "W" : s.us < s.them ? "L" : "D";
}

/** Matches a club played on the given side, oldest first. */
function playedBy(matches: MatchView[], teamId: string, side: Side): MatchView[] {
  return matches.filter((v) => {
    if (v.match.status !== "finished" || !v.match.score) return false;
    if (side === "home") return v.home.id === teamId;
    if (side === "away") return v.away.id === teamId;
    return v.home.id === teamId || v.away.id === teamId;
  });
}

export function teamRecord(matches: MatchView[], teamId: string, side: Side = "all"): TeamRecord {
  const out = { ...EMPTY_RECORD };
  for (const v of playedBy(matches, teamId, side)) {
    const s = scoreFor(v, teamId);
    if (!s) continue;
    out.played++;
    out.goalsFor += s.us;
    out.goalsAgainst += s.them;
    if (s.us > s.them) out.won++;
    else if (s.us < s.them) out.lost++;
    else out.drawn++;
    if (s.them === 0) out.cleanSheets++;
    if (s.us === 0) out.blanks++;
  }
  return out;
}

/** Goals a match, to one decimal place. Zero matches is zero rather than NaN. */
export function per(total: number, played: number): number {
  return played > 0 ? Math.round((total / played) * 10) / 10 : 0;
}

export interface Streak {
  kind: "W" | "D" | "L" | "unbeaten" | "winless";
  count: number;
}

/**
 * The run a club arrives on.
 *
 * A repeated result is the strongest thing to say, so it is preferred; failing
 * that, a long unbeaten or winless run says something a form guide of five
 * letters makes the reader count for themselves. Anything shorter is not a run
 * and claiming it would be noise.
 */
export function currentStreak(matches: MatchView[], teamId: string): Streak | null {
  return streakFrom(
    playedBy(matches, teamId, "all")
      .map((v) => resultFor(v, teamId))
      .filter((r): r is FormResult => r !== null)
      .reverse(),
  );
}

/**
 * The same judgement from results alone, most recent first.
 *
 * A standings row already carries each club's last five, so the home page can
 * ask this without reading a single match — and asking it here rather than
 * writing the rule out twice means a run means one thing across the site.
 */
export function streakFrom(results: FormResult[]): Streak | null {
  if (results.length === 0) return null;

  let same = 1;
  while (same < results.length && results[same] === results[0]) same++;
  if (same >= 2) return { kind: results[0], count: same };

  let unbeaten = 0;
  while (unbeaten < results.length && results[unbeaten] !== "L") unbeaten++;
  if (unbeaten >= 3) return { kind: "unbeaten", count: unbeaten };

  let winless = 0;
  while (winless < results.length && results[winless] !== "W") winless++;
  if (winless >= 3) return { kind: "winless", count: winless };

  return null;
}

export interface HeadToHead {
  played: number;
  /** Wins for the club at home in *this* fixture, wherever the past meetings were played. */
  homeWins: number;
  draws: number;
  awayWins: number;
  homeGoals: number;
  awayGoals: number;
  /** Most recent first. */
  recent: MatchView[];
}

export function headToHead(
  matches: MatchView[],
  homeId: string,
  awayId: string,
  excludeMatchId?: string,
  limit = 5,
): HeadToHead {
  const meetings = matches.filter(
    (v) =>
      v.match.status === "finished" &&
      v.match.id !== excludeMatchId &&
      ((v.home.id === homeId && v.away.id === awayId) ||
        (v.home.id === awayId && v.away.id === homeId)),
  );
  const out: HeadToHead = {
    played: 0,
    homeWins: 0,
    draws: 0,
    awayWins: 0,
    homeGoals: 0,
    awayGoals: 0,
    recent: [...meetings].reverse().slice(0, limit),
  };
  for (const v of meetings) {
    const s = scoreFor(v, homeId);
    if (!s) continue;
    out.played++;
    out.homeGoals += s.us;
    out.awayGoals += s.them;
    if (s.us > s.them) out.homeWins++;
    else if (s.us < s.them) out.awayWins++;
    else out.draws++;
  }
  return out;
}

/** Everything one club brings to a fixture. */
export interface TeamContext {
  /** Their league row, when the competition has a table and they are in it. */
  row: StandingRow | null;
  /** Last five, most recent first, with the match each result came from. */
  form: { result: FormResult; view: MatchView }[];
  /** The record for the side they are playing here — home team home, away team away. */
  side: TeamRecord;
  overall: TeamRecord;
  streak: Streak | null;
}

export interface MatchContext {
  home: TeamContext;
  away: TeamContext;
  h2h: HeadToHead;
  /** False when neither club has played, so the page can leave the section out. */
  hasAnything: boolean;
}

function contextFor(
  matches: MatchView[],
  teamId: string,
  side: Side,
  rows: StandingRow[],
  excludeMatchId?: string,
): TeamContext {
  const finished = playedBy(matches, teamId, "all").filter((v) => v.match.id !== excludeMatchId);
  return {
    row: rows.find((r) => r.teamId === teamId) ?? null,
    form: finished
      .slice(-5)
      .reverse()
      .map((view) => ({ result: resultFor(view, teamId)!, view })),
    side: teamRecord(
      matches.filter((v) => v.match.id !== excludeMatchId),
      teamId,
      side,
    ),
    overall: teamRecord(
      matches.filter((v) => v.match.id !== excludeMatchId),
      teamId,
      "all",
    ),
    streak: currentStreak(finished, teamId),
  };
}

export function buildMatchContext({
  homeId,
  awayId,
  homeMatches,
  awayMatches,
  rows,
  excludeMatchId,
}: {
  homeId: string;
  awayId: string;
  homeMatches: MatchView[];
  awayMatches: MatchView[];
  rows: StandingRow[];
  excludeMatchId?: string;
}): MatchContext {
  const home = contextFor(homeMatches, homeId, "home", rows, excludeMatchId);
  const away = contextFor(awayMatches, awayId, "away", rows, excludeMatchId);
  const h2h = headToHead(homeMatches, homeId, awayId, excludeMatchId);
  return {
    home,
    away,
    h2h,
    hasAnything: home.overall.played > 0 || away.overall.played > 0 || h2h.played > 0,
  };
}

/** A club on a run, with the competition the run was made in. */
export interface FormEntry {
  competitionId: string;
  teamId: string;
  streak: Streak;
  /** Their last five, most recent first. */
  form: FormResult[];
}

/**
 * The clubs arriving in the best form, across every competition at once.
 *
 * Only runs worth the name: a win streak first, then an unbeaten one, longest
 * first. Bad runs are left out — the site is somewhere to read a score, not a
 * board of shame, and "three without a win" beside a golden boot race is a
 * change of subject rather than a second opinion.
 *
 * Read from standings rows, which already carry each club's last five, so this
 * asks nothing of the database that the page had not already asked.
 */
export function clubsInForm(
  tables: { competitionId: string; rows: StandingRow[] }[],
  limit = 6,
): FormEntry[] {
  const out: FormEntry[] = [];
  for (const { competitionId, rows } of tables) {
    for (const row of rows) {
      // `form` is oldest first, and a run is read backwards from the last match.
      const form = [...row.form].reverse();
      const streak = streakFrom(form);
      if (!streak || (streak.kind !== "W" && streak.kind !== "unbeaten")) continue;
      out.push({ competitionId, teamId: row.teamId, streak, form });
    }
  }
  const rank = (e: FormEntry) => (e.streak.kind === "W" ? 100 : 0) + e.streak.count;
  return out.sort((a, b) => rank(b) - rank(a)).slice(0, limit);
}
