import { describe, expect, it } from "vitest";
import { whyItMatters } from "../data/why";
import type { HeadToHead, TeamContext } from "../data/match-context";
import type { Stake } from "../data/scenarios";

const side = (position: number, streak?: TeamContext["streak"]): TeamContext =>
  ({ row: { position }, streak: streak ?? null, form: [] }) as unknown as TeamContext;

const noH2H: HeadToHead = {
  played: 0,
  homeWins: 0,
  draws: 0,
  awayWins: 0,
  homeGoals: 0,
  awayGoals: 0,
  recent: [],
};

const three = (h: [number, number], d: [number, number], a: [number, number]): Stake[] => [
  { outcome: "home", home: h[0], away: h[1] },
  { outcome: "draw", home: d[0], away: d[1] },
  { outcome: "away", home: a[0], away: a[1] },
];

describe("whyItMatters", () => {
  it("says what a win would do, for the club it would do most for", () => {
    // 2nd at home, a win takes them top; the away club is 11th either way.
    const out = whyItMatters({
      stakes: three([1, 11], [2, 11], [2, 11]),
      home: side(2),
      away: side(11),
      h2h: noH2H,
      places: 20,
    });
    expect(out[0]).toEqual({ kind: "climb", outcome: "home", team: "home", to: 1 });
  });

  it("says what a draw settles, when it settles nothing", () => {
    const out = whyItMatters({
      stakes: three([1, 11], [2, 11], [2, 11]),
      home: side(2),
      away: side(11),
      h2h: noH2H,
      places: 20,
    });
    expect(out).toContainEqual({ kind: "hold", team: "home", at: 2 });
  });

  it("does not claim a climb that is not one", () => {
    // Top already, and a win keeps them there: nothing to climb to.
    const out = whyItMatters({
      stakes: three([1, 9], [1, 9], [1, 9]),
      home: side(1),
      away: side(9),
      h2h: noH2H,
      places: 20,
    });
    expect(out.some((w) => w.kind === "climb")).toBe(false);
  });

  it("notices two clubs a long way apart", () => {
    const out = whyItMatters({
      stakes: three([18, 2], [19, 2], [19, 2]),
      home: side(19),
      away: side(2),
      h2h: noH2H,
      places: 20,
    });
    expect(out).toContainEqual({ kind: "gap", team: "home", places: 17 });
  });

  it("reports a one-sided record between them", () => {
    const out = whyItMatters({
      stakes: three([9, 9], [9, 9], [9, 9]),
      home: side(9),
      away: side(9),
      h2h: { ...noH2H, played: 4, homeWins: 0, awayWins: 3, draws: 1 },
      places: 20,
    });
    expect(out).toContainEqual({ kind: "h2hRun", team: "away", played: 4 });
  });

  it("reports a run, and only a good one", () => {
    const won = whyItMatters({
      stakes: three([9, 9], [9, 9], [9, 9]),
      home: side(9, { kind: "W", count: 4 }),
      away: side(9, { kind: "L", count: 5 }),
      h2h: noH2H,
      places: 20,
    });
    expect(won).toContainEqual({ kind: "streak", team: "home", count: 4, won: true });
    const none = whyItMatters({
      stakes: three([9, 9], [9, 9], [9, 9]),
      home: side(9, { kind: "L", count: 5 }),
      away: side(9, { kind: "winless", count: 6 }),
      h2h: noH2H,
      places: 20,
    });
    expect(none.some((w) => w.kind === "streak")).toBe(false);
  });

  it("says nothing rather than filler, and never more than three things", () => {
    expect(
      whyItMatters({ stakes: [], home: side(9), away: side(10), h2h: noH2H, places: 20 }),
    ).toEqual([]);
    const busy = whyItMatters({
      stakes: three([1, 20], [4, 19], [5, 18]),
      home: side(4, { kind: "W", count: 5 }),
      away: side(19, { kind: "unbeaten", count: 4 }),
      h2h: { ...noH2H, played: 5, homeWins: 5 },
      places: 20,
    });
    expect(busy.length).toBeLessThanOrEqual(3);
  });
});
