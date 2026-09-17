import { describe, expect, it } from "vitest";
import { runIn, undecided, zoneVerdict } from "../data/run-in";
import type { Match, StandingRow, TableZone } from "../types";

const row = (teamId: string, position: number, points: number, played: number): StandingRow =>
  ({ teamId, position, points, played, form: [] }) as unknown as StandingRow;

let n = 0;
const fixture = (
  home: string,
  away: string,
  round: number,
  status: Match["status"] = "scheduled",
): Match =>
  ({
    id: `m${++n}`,
    slug: `${home}-vs-${away}-${round}`,
    round,
    kickoff: `2027-05-0${Math.min(9, round)}T15:00:00.000Z`,
    homeTeamId: home,
    awayTeamId: away,
    status,
  }) as unknown as Match;

describe("runIn", () => {
  it("counts what is left and what it is worth", () => {
    const rows = [row("a", 1, 80, 36), row("b", 2, 74, 36)];
    const matches = [fixture("a", "b", 37), fixture("b", "a", 38)];
    const [a, b] = runIn(rows, matches, 38);
    expect(a.remaining).toBe(2);
    expect(a.maxPoints).toBe(86);
    expect(b.maxPoints).toBe(80);
    // 80 points from 36 games, over 38: a pace, not a prediction.
    expect(a.pace).toBe(84);
  });

  it("proves a title rather than calling it", () => {
    // 80 v 70 with one match each: the chaser can reach 73 and no further.
    const rows = [row("a", 1, 80, 37), row("b", 2, 70, 37)];
    const matches = [fixture("a", "x", 38), fixture("b", "y", 38)];
    const [a, b] = runIn(rows, matches, 38);
    expect(a.best).toBe(1);
    expect(a.worst).toBe(1); // cannot be caught
    expect(b.best).toBe(2);
    expect(b.worst).toBe(2);
  });

  it("settles a gap that the remaining matches cannot close", () => {
    // One match each, six points apart: 74 + 3 is still short of 80, whatever
    // happens anywhere else.
    const rows = [row("a", 1, 80, 37), row("b", 2, 74, 37)];
    const [a, b] = runIn(rows, [fixture("a", "x", 38), fixture("b", "y", 38)], 38);
    expect([a.best, a.worst]).toEqual([1, 1]);
    expect([b.best, b.worst]).toEqual([2, 2]);
  });

  it("leaves it open while the points are still there", () => {
    // Two matches each, six points apart: 74 + 6 = 80, level on points, and a
    // goal difference nobody can predict decides it. Both ends stay open.
    const rows = [row("a", 1, 80, 36), row("b", 2, 74, 36)];
    const matches = [
      fixture("a", "x", 37),
      fixture("a", "y", 38),
      fixture("b", "y", 37),
      fixture("b", "x", 38),
    ];
    const [a, b] = runIn(rows, matches, 38);
    expect([a.best, a.worst]).toEqual([1, 2]);
    expect([b.best, b.worst]).toEqual([1, 2]);
  });

  it("reads the final table off itself once nothing is left", () => {
    // Level on points, separated by the table's own order. Nothing to play.
    const rows = [row("a", 1, 80, 38), row("b", 2, 80, 38), row("c", 3, 50, 38)];
    const out = runIn(rows, [], 38);
    expect(out.map((r) => [r.best, r.worst])).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });

  it("ignores a knockout tie and a cancelled match", () => {
    const rows = [row("a", 1, 12, 6), row("b", 2, 9, 6)];
    const matches = [
      fixture("a", "b", 7),
      fixture("a", "b", 9), // past the league phase
      fixture("b", "a", 8, "cancelled"),
    ];
    const [a] = runIn(rows, matches, 8);
    expect(a.remaining).toBe(1);
  });

  it("counts a postponed match as still to play", () => {
    const rows = [row("a", 1, 12, 6)];
    const [a] = runIn(rows, [fixture("a", "b", 7, "postponed")], 38);
    expect(a.remaining).toBe(1);
  });

  it("describes the run-in from the table, not from names", () => {
    const rows = [row("a", 1, 10, 5), row("b", 2, 9, 5), row("c", 3, 3, 5)];
    const matches = [fixture("a", "b", 6), fixture("c", "a", 7)];
    const [a] = runIn(rows, matches, 38);
    expect(a.fixtures.map((f) => [f.opponentId, f.home, f.opponentPosition])).toEqual([
      ["b", true, 2],
      ["c", false, 3],
    ]);
    expect(a.difficulty).toBe(2.5);
  });

  it("measures the run-in over the next few, not the whole remainder", () => {
    const rows = [row("a", 1, 10, 5), row("b", 2, 9, 5), row("c", 3, 3, 5)];
    // Two hard matches next, then an easy one that is not part of the run-in.
    const matches = [fixture("a", "b", 6), fixture("b", "a", 7), fixture("a", "c", 8)];
    const [a] = runIn(rows, matches, 38, 2);
    expect(a.fixtures).toHaveLength(2);
    expect(a.difficulty).toBe(2);
    expect(a.remaining).toBe(3); // ...but all three still count for the points
    expect(a.maxPoints).toBe(19);
  });

  it("has no difficulty and no fixtures once a club has finished", () => {
    const [a] = runIn([row("a", 1, 80, 38)], [], 38);
    expect(a.difficulty).toBeNull();
    expect(a.fixtures).toEqual([]);
    expect(a.remaining).toBe(0);
  });
});

describe("zoneVerdict", () => {
  const top: TableZone = { from: 1, to: 4, label: "Champions League", tone: "top" };
  const drop: TableZone = { from: 18, to: 20, label: "Relegation", tone: "bottom" };

  it("only says secured when the whole range is inside the zone", () => {
    expect(zoneVerdict({ best: 1, worst: 3 }, top)).toBe("secured");
    expect(zoneVerdict({ best: 1, worst: 5 }, top)).toBe("open");
    expect(zoneVerdict({ best: 5, worst: 9 }, top)).toBe("out");
  });

  it("works the same way for a zone nobody wants", () => {
    expect(zoneVerdict({ best: 18, worst: 20 }, drop)).toBe("secured"); // down
    expect(zoneVerdict({ best: 9, worst: 17 }, drop)).toBe("out"); // safe
    expect(zoneVerdict({ best: 15, worst: 19 }, drop)).toBe("open");
  });
});

describe("undecided", () => {
  it("is true in August and false the moment a club is pinned", () => {
    const rows = [row("a", 1, 3, 1), row("b", 2, 0, 1)];
    const matches = Array.from({ length: 4 }, (_, i) => fixture("a", "b", i + 2));
    expect(undecided(runIn(rows, matches, 38))).toBe(true);
    expect(undecided(runIn(rows, [], 38))).toBe(false);
  });
});
