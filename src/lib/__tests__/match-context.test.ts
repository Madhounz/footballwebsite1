import { describe, expect, it } from "vitest";
import {
  buildMatchContext,
  currentStreak,
  headToHead,
  per,
  resultFor,
  teamRecord,
} from "../data/match-context";
import { barColors } from "../colors";
import type { Competition, MatchView, Team } from "../types";

const competition = { id: "epl", shortName: "PL" } as Competition;
const team = (id: string) => ({ id, slug: id, name: id, shortName: id }) as Team;

let n = 0;
/** One finished match, oldest first in the order they are declared. */
function played(homeId: string, awayId: string, home: number, away: number): MatchView {
  n++;
  return {
    competition,
    home: team(homeId),
    away: team(awayId),
    match: {
      id: `m${n}`,
      status: "finished",
      score: { home, away },
      kickoff: `2026-09-${String(n).padStart(2, "0")}T14:00:00.000Z`,
    },
  } as MatchView;
}

function scheduled(homeId: string, awayId: string): MatchView {
  n++;
  return {
    competition,
    home: team(homeId),
    away: team(awayId),
    match: { id: `m${n}`, status: "scheduled", score: null, kickoff: "2026-10-01T14:00:00.000Z" },
  } as MatchView;
}

describe("match context", () => {
  it("reads a result from either side of the scoreline", () => {
    const v = played("arsenal", "chelsea", 2, 1);
    expect(resultFor(v, "arsenal")).toBe("W");
    expect(resultFor(v, "chelsea")).toBe("L");
    expect(resultFor(v, "spurs")).toBeNull();
    expect(resultFor(scheduled("arsenal", "chelsea"), "arsenal")).toBeNull();
  });

  it("counts a record for one side of the season only", () => {
    const matches = [
      played("arsenal", "chelsea", 3, 0),
      played("spurs", "arsenal", 1, 1),
      played("arsenal", "spurs", 0, 2),
      played("chelsea", "arsenal", 0, 0),
      scheduled("arsenal", "everton"),
    ];
    const all = teamRecord(matches, "arsenal");
    expect(all).toMatchObject({
      played: 4,
      won: 1,
      drawn: 2,
      lost: 1,
      goalsFor: 4,
      goalsAgainst: 3,
    });
    // Two clean sheets, and one match they did not score in.
    expect(all.cleanSheets).toBe(2);
    expect(all.blanks).toBe(2);

    const home = teamRecord(matches, "arsenal", "home");
    expect(home).toMatchObject({ played: 2, won: 1, lost: 1, goalsFor: 3, goalsAgainst: 2 });
    const away = teamRecord(matches, "arsenal", "away");
    expect(away).toMatchObject({ played: 2, won: 0, drawn: 2, goalsFor: 1, goalsAgainst: 1 });
  });

  it("gives goals a match without dividing by nothing", () => {
    expect(per(7, 4)).toBe(1.8);
    expect(per(0, 0)).toBe(0);
  });

  it("prefers a repeated result, then an unbeaten run, then nothing", () => {
    const wins = [
      played("arsenal", "a", 1, 0),
      played("arsenal", "b", 0, 1),
      played("arsenal", "c", 2, 0),
      played("arsenal", "d", 3, 1),
    ];
    expect(currentStreak(wins, "arsenal")).toEqual({ kind: "W", count: 2 });

    // W D D: no repeated result at the front long enough to beat an unbeaten run.
    const unbeaten = [
      played("arsenal", "a", 0, 3),
      played("arsenal", "b", 1, 0),
      played("arsenal", "c", 1, 1),
      played("arsenal", "d", 2, 2),
    ];
    expect(currentStreak(unbeaten, "arsenal")).toEqual({ kind: "D", count: 2 });

    // A single result at the front, and only two matches behind it: no run to claim.
    const quiet = [played("arsenal", "a", 1, 0), played("arsenal", "b", 0, 2)];
    expect(currentStreak(quiet, "arsenal")).toBeNull();
    expect(currentStreak([], "arsenal")).toBeNull();
  });

  it("counts head to head from this fixture's home side, wherever it was played", () => {
    const matches = [
      played("arsenal", "chelsea", 2, 0), // Arsenal win at home
      played("chelsea", "arsenal", 3, 1), // Arsenal lose away
      played("chelsea", "arsenal", 1, 1),
      played("arsenal", "spurs", 5, 0), // different opponent, ignored
    ];
    const h = headToHead(matches, "arsenal", "chelsea");
    expect(h).toMatchObject({
      played: 3,
      homeWins: 1,
      draws: 1,
      awayWins: 1,
      homeGoals: 4,
      awayGoals: 4,
    });
    expect(h.recent).toHaveLength(3);
    // Most recent first.
    expect(h.recent[0].match.id).toBe(matches[2].match.id);
  });

  it("leaves the match being previewed out of its own context", () => {
    const fixture = scheduled("arsenal", "chelsea");
    const matches = [played("arsenal", "chelsea", 2, 0), fixture];
    const ctx = buildMatchContext({
      homeId: "arsenal",
      awayId: "chelsea",
      homeMatches: matches,
      awayMatches: matches,
      rows: [],
      excludeMatchId: fixture.match.id,
    });
    expect(ctx.home.overall.played).toBe(1);
    expect(ctx.h2h.played).toBe(1);
    expect(ctx.hasAnything).toBe(true);

    // A finished match must not count itself towards its own build-up either.
    const done = played("arsenal", "chelsea", 1, 1);
    const after = buildMatchContext({
      homeId: "arsenal",
      awayId: "chelsea",
      homeMatches: [done],
      awayMatches: [done],
      rows: [],
      excludeMatchId: done.match.id,
    });
    expect(after.home.overall.played).toBe(0);
    expect(after.h2h.played).toBe(0);
    expect(after.hasAnything).toBe(false);
  });

  it("takes each club's league row and the right side of their season", () => {
    const matches = [
      played("arsenal", "chelsea", 1, 0),
      played("chelsea", "arsenal", 2, 2),
      played("chelsea", "spurs", 0, 1),
    ];
    const ctx = buildMatchContext({
      homeId: "arsenal",
      awayId: "chelsea",
      homeMatches: matches,
      awayMatches: matches,
      rows: [{ teamId: "chelsea", position: 4, points: 9 }] as never,
    });
    expect(ctx.home.row).toBeNull();
    expect(ctx.away.row?.position).toBe(4);
    // Arsenal's home record, Chelsea's away record — the sides they play here.
    expect(ctx.home.side.played).toBe(1);
    expect(ctx.away.side.played).toBe(1);
    expect(ctx.home.form[0].result).toBe("D");
  });
});

describe("bar colours", () => {
  const club = (id: string, colors: [string, string]) => ({ ...team(id), colors }) as Team;

  it("keeps two club colours when they are far enough apart", () => {
    const c = barColors(club("city", ["#6CABDD", "#1C2C5B"]), club("chelsea", ["#034694", "#fff"]));
    expect(c).toEqual({ home: "#6CABDD", away: "#034694" });
  });

  it("moves the away side off a colour clash — two reds is a chart in one colour", () => {
    const liverpool = club("liverpool", ["#C8102E", "#00B2A9"]);
    const united = club("united", ["#DA291C", "#FBE122"]);
    const c = barColors(liverpool, united);
    expect(c.home).toBe("#C8102E");
    // Their second colour is nothing like Liverpool's red, so it is used.
    expect(c.away).toBe("#FBE122");
  });

  it("falls back to a neutral when a club has no second colour to offer", () => {
    const c = barColors(club("a", ["#C8102E", "#C9112F"]), club("b", ["#DA291C", "#D5202A"]));
    expect(c.away).toBe("var(--text-muted)");
  });
});
