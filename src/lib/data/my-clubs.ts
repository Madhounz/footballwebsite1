import { dateOf, type ISODate } from "../dates";
import { isLive } from "../live-status";

/**
 * The order your own clubs belong in, and what the day amounts to.
 *
 * A followed list is not a table and should not be sorted like one. What a
 * person opening it wants is the same thing every time: what is happening
 * *now*, then what is happening soon, then everything else. So a club in play
 * comes first, then one playing today, then the rest by kick-off, and a club
 * with nothing in the diary sits at the bottom rather than in the middle of
 * the clubs that do.
 *
 * Pure, and deliberately not a component: the page that uses it renders only
 * in a browser, and none of this needs one to be checked.
 */
export interface ClubMatch {
  kickoff: string;
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
  minute: number | null;
}

export interface ClubLike<M extends ClubMatch = ClubMatch> {
  id: string;
  next: M | null;
  last: M | null;
}

/** Which match a card is about: the one in play or to come, else the last one. */
export function shownMatch<M extends ClubMatch>(club: ClubLike<M>): M | null {
  return club.next ?? club.last;
}

function rank(club: ClubLike, today: ISODate): number {
  const m = shownMatch(club);
  if (!m) return 4;
  if (isLive(m)) return 0;
  if (club.next && dateOf(m.kickoff) === today) return 1;
  if (club.next) return 2;
  return 3; // played, nothing next
}

export function sortClubs<C extends ClubLike>(clubs: C[], today: ISODate): C[] {
  return [...clubs]
    .map((club, i) => ({ club, i, rank: rank(club, today) }))
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const am = shownMatch(a.club);
      const bm = shownMatch(b.club);
      // Within a group, soonest first — and for clubs whose match has been and
      // gone, most recent first, which is the same comparison reversed.
      if (am && bm && am.kickoff !== bm.kickoff) {
        return a.rank >= 3
          ? bm.kickoff.localeCompare(am.kickoff)
          : am.kickoff.localeCompare(bm.kickoff);
      }
      return a.i - b.i;
    })
    .map((e) => e.club);
}

export interface Pulse {
  clubs: number;
  live: number;
  today: number;
  /** The next kick-off still to come, across every followed club. */
  nextKickoff: string | null;
  /** Whose match that is — "next: Chelsea, Sunday" beats "next: Sunday". */
  nextClubId: string | null;
}

export function pulse(clubs: ClubLike[], today: ISODate): Pulse {
  let live = 0;
  let playing = 0;
  let next: string | null = null;
  let whose: string | null = null;
  for (const club of clubs) {
    const m = shownMatch(club);
    if (!m) continue;
    if (isLive(m)) live++;
    if (club.next && dateOf(m.kickoff) === today) playing++;
    if (club.next && m.status !== "live" && (next === null || m.kickoff < next)) {
      next = m.kickoff;
      whose = club.id;
    }
  }
  return { clubs: clubs.length, live, today: playing, nextKickoff: next, nextClubId: whose };
}
