import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { pulse, shownMatch, sortClubs, type ClubLike } from "../data/my-clubs";
import type { ISODate } from "../dates";

const today = "2026-09-17" as ISODate;

// `isLive` reads the wall clock — a match is only in play for so long after
// kick-off. Without a fixed clock these tests pass in the afternoon and fail
// in the evening, which is the worst kind of test there is.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-17T19:20:00.000Z"));
});
afterAll(() => vi.useRealTimers());

const m = (
  kickoff: string,
  status: "scheduled" | "live" | "finished" = "scheduled",
  minute: number | null = null,
) => ({ kickoff, status, minute });

const club = (
  id: string,
  next: ReturnType<typeof m> | null,
  last: ReturnType<typeof m> | null = null,
): ClubLike => ({ id, next, last });

describe("sortClubs", () => {
  it("puts what is happening now above what happens later", () => {
    const clubs = [
      club("later", m("2026-09-20T15:00:00.000Z")),
      club("playing", m("2026-09-17T19:00:00.000Z", "live", 63)),
      club("tonight", m("2026-09-17T21:00:00.000Z")),
    ];
    expect(sortClubs(clubs, today).map((c) => c.id)).toEqual(["playing", "tonight", "later"]);
  });

  it("sinks a club with nothing in the diary below the clubs that have", () => {
    const clubs = [
      club("idle", null, m("2026-09-10T15:00:00.000Z", "finished")),
      club("soon", m("2026-09-19T15:00:00.000Z")),
    ];
    expect(sortClubs(clubs, today).map((c) => c.id)).toEqual(["soon", "idle"]);
  });

  it("orders those idle clubs by who played most recently", () => {
    const clubs = [
      club("old", null, m("2026-09-01T15:00:00.000Z", "finished")),
      club("recent", null, m("2026-09-14T15:00:00.000Z", "finished")),
    ];
    expect(sortClubs(clubs, today).map((c) => c.id)).toEqual(["recent", "old"]);
  });

  it("keeps the order they were followed in when nothing separates them", () => {
    const same = m("2026-09-19T15:00:00.000Z");
    const clubs = [club("b", same), club("a", same), club("c", same)];
    expect(sortClubs(clubs, today).map((c) => c.id)).toEqual(["b", "a", "c"]);
  });

  it("does not mutate what it was given", () => {
    const clubs = [
      club("z", m("2026-09-30T15:00:00.000Z")),
      club("a", m("2026-09-18T15:00:00.000Z")),
    ];
    sortClubs(clubs, today);
    expect(clubs.map((c) => c.id)).toEqual(["z", "a"]);
  });
});

describe("shownMatch", () => {
  it("prefers the one to come over the one gone", () => {
    const next = m("2026-09-19T15:00:00.000Z");
    const last = m("2026-09-10T15:00:00.000Z", "finished");
    expect(shownMatch(club("a", next, last))).toBe(next);
    expect(shownMatch(club("a", null, last))).toBe(last);
    expect(shownMatch(club("a", null, null))).toBeNull();
  });
});

describe("pulse", () => {
  it("counts the day and finds the next kick-off", () => {
    const p = pulse(
      [
        club("live", m("2026-09-17T19:00:00.000Z", "live", 20)),
        club("tonight", m("2026-09-17T21:00:00.000Z")),
        club("friday", m("2026-09-18T18:00:00.000Z")),
        club("idle", null, m("2026-09-01T15:00:00.000Z", "finished")),
      ],
      today,
    );
    expect(p).toEqual({
      clubs: 4,
      live: 1,
      today: 2,
      // The match already in play is not a kick-off still to come.
      nextKickoff: "2026-09-17T21:00:00.000Z",
      nextClubId: "tonight",
    });
  });

  it("says nothing is coming when nothing is", () => {
    expect(pulse([club("idle", null, m("2026-09-01T15:00:00.000Z", "finished"))], today)).toEqual({
      clubs: 1,
      live: 0,
      today: 0,
      nextKickoff: null,
      nextClubId: null,
    });
  });
});
