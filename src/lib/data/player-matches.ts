import type { MatchEvent, MatchView } from "../types";
import type { PlayerMatch } from "./repository";

/** Nominal length of a match, for minutes played. Stoppage time is not counted. */
const FULL_TIME = 90;

/**
 * What a player did in one match, from the line-up and the events — the same
 * derived-not-stored rule the tables follow. A match they neither started nor
 * came on in is not an appearance and never reaches the page.
 *
 * Minutes are nominal: on from the whistle or from the minute they came on,
 * off at the final whistle or the minute they were replaced. Stoppage time is
 * left out rather than guessed at, so the number is comparable between matches.
 */
export function playerMatchFrom(
  playerId: string,
  view: MatchView,
  starting: string[],
  events: MatchEvent[],
): PlayerMatch | null {
  const started = starting.includes(playerId);
  const mine = events.filter((e) => e.playerId === playerId || e.relatedPlayerId === playerId);
  // The player named in a substitution is the one going off; the related one is
  // coming on. Both halves of the test have to be inside the same condition.
  const sub = (on: boolean) =>
    mine.find(
      (e) =>
        e.type === "substitution" &&
        (on ? e.relatedPlayerId === playerId : e.playerId === playerId),
    );
  const onEvent = started ? undefined : sub(true);
  const offEvent = sub(false);
  if (!started && !onEvent) return null;

  // Deliberately the raw status rather than `isLive`. This decides where a
  // player's minutes stop, and for a match abandoned mid-play the last minute
  // we were told is the honest answer: treating it as not-live would run him to
  // ninety and claim he played a match that never finished.
  const live = view.match.status === "live";
  const end = offEvent?.minute ?? (live ? (view.match.minute ?? 0) : FULL_TIME);
  const from = started ? 0 : (onEvent?.minute ?? 0);
  const scored = (t: MatchEvent["type"]) => t === "goal" || t === "penalty";
  return {
    view,
    started,
    onMinute: onEvent?.minute ?? null,
    offMinute: offEvent?.minute ?? null,
    minutes: Math.max(0, end - from),
    goals: mine.filter((e) => e.playerId === playerId && scored(e.type)).length,
    ownGoals: mine.filter((e) => e.playerId === playerId && e.type === "own_goal").length,
    assists: mine.filter((e) => e.relatedPlayerId === playerId && e.type === "goal").length,
    yellow: mine.filter((e) => e.playerId === playerId && e.type === "yellow").length,
    red: mine.some(
      (e) => e.playerId === playerId && (e.type === "red" || e.type === "second_yellow"),
    ),
  };
}

/** Most recent first: a player's page is read from the last match backwards. */
export function byMostRecent(a: PlayerMatch, b: PlayerMatch): number {
  return b.view.match.kickoff.localeCompare(a.view.match.kickoff);
}
