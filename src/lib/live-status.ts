import type { Match } from "./types";

/**
 * Whether a match is still plausibly being played.
 *
 * A stored status is what a provider last told us, and a provider can stop
 * telling us. A match abandoned for rain, or postponed after the clock had
 * started, leaves a record saying "live" that nothing corrects until the next
 * full sync — and in the meantime the site pulses a green dot beside a match
 * that finished hours ago, or never started. That is the one thing a scores
 * site must not do.
 *
 * So liveness is not read from the status alone. Ninety minutes, half-time,
 * extra time, penalties and a long weather delay still fit inside three and a
 * half hours; past that, a record saying "live" is not a match in play, it is
 * a record nobody has corrected.
 *
 * Nothing here rewrites the status. What happened to that match is a fact and
 * facts come from providers — the site simply stops claiming to know it, and
 * says so, until somebody tells us.
 */
export const LIVE_LIMIT_MIN = 210;

type Timed = Pick<Match, "status" | "kickoff">;

export function minutesSinceKickoff(kickoff: string, now: Date = new Date()): number {
  return (now.getTime() - new Date(kickoff).getTime()) / 60_000;
}

/** Marked live, and recently enough for that to still be true. */
export function isLive(m: Timed, now: Date = new Date()): boolean {
  return m.status === "live" && minutesSinceKickoff(m.kickoff, now) <= LIVE_LIMIT_MIN;
}

/**
 * Marked live long after any match could still be running. The result is
 * unknown rather than nil-nil, and the page should say so.
 */
export function isStaleLive(m: Timed, now: Date = new Date()): boolean {
  return m.status === "live" && minutesSinceKickoff(m.kickoff, now) > LIVE_LIMIT_MIN;
}

/**
 * What the browser tab says while matches are being played.
 *
 * A scores site gets left open in a background tab, and a background tab shows
 * about fifteen characters and a favicon. So those characters may as well
 * carry the news: the count sits in front of the title the way an inbox
 * carries its unread count, and a match page puts the score itself there.
 */
/** The unread-count trick, for a page that is watching several at once. */
export function liveCountTitle(count: number, title: string): string {
  return count > 0 ? `(${count}) ${title}` : title;
}
