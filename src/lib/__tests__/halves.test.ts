import { describe, expect, it } from "vitest";
import { halfScore, halfTable, turnarounds } from "../data/halves";
import type { Match } from "../types";

let n = 0;
function match(
  home: string,
  away: string,
  ht: [number, number] | null,
  ft: [number, number] | null,
  status = "finished",
): Match {
  n++;
  return {
    id: `m${n}`,
    competitionId: "epl",
    season: "2026/27",
    round: n,
    kickoff: `2026-09-${String(n).padStart(2, "0")}T14:00:00.000Z`,
    status,
    homeTeamId: home,
    awayTeamId: away,
    score: ft ? { home: ft[0], away: ft[1] } : null,
    halfTimeScore: ht ? { home: ht[0], away: ht[1] } : null,
  } as Match;
}

describe("a half of a match", () => {
  it("takes the first half as it stood at the break", () => {
    expect(halfScore(match("a", "b", [1, 0], [3, 1]), "first")).toEqual({ home: 1, away: 0 });
  });

  it("gets the second half by subtraction", () => {
    expect(halfScore(match("a", "b", [1, 0], [3, 1]), "second")).toEqual({ home: 2, away: 1 });
    // A goalless second half is a real result, not a missing one.
    expect(halfScore(match("a", "b", [2, 2], [2, 2]), "second")).toEqual({ home: 0, away: 0 });
  });

  it("leaves out a match it cannot split", () => {
    expect(halfScore(match("a", "b", null, [2, 0]), "first")).toBeNull();
    expect(halfScore(match("a", "b", [1, 0], null), "second")).toBeNull();
    expect(halfScore(match("a", "b", [1, 0], [2, 0], "scheduled"), "second")).toBeNull();
    // Two scorelines that disagree: a second half cannot un-score a goal.
    expect(halfScore(match("a", "b", [3, 0], [2, 0]), "second")).toBeNull();
  });
});

describe("the half tables", () => {
  const ids = ["a", "b", "c", "d"];
  // "a" leads both matches at the break and is pegged back in both.
  // "c" is behind at half-time twice and wins both after it.
  const season = [
    match("a", "b", [2, 0], [2, 2]),
    match("c", "d", [0, 1], [3, 1]),
    match("a", "c", [1, 0], [1, 2]),
    match("b", "d", [0, 0], [0, 0]),
  ];

  it("gives the first half to the club that keeps starting well", () => {
    const first = halfTable("epl", "2026/27", ids, season, "first");
    expect(first.rows[0].teamId).toBe("a");
    expect(first.rows[0]).toMatchObject({ played: 2, won: 2, points: 6, goalsFor: 3 });
  });

  it("gives the second half to the club that keeps finishing well", () => {
    const second = halfTable("epl", "2026/27", ids, season, "second");
    expect(second.rows[0].teamId).toBe("c");
    // 0–2 after the break against "d", then 2–1 at "a".
    expect(second.rows[0]).toMatchObject({ played: 2, won: 2, points: 6 });
    const a = second.rows.find((r) => r.teamId === "a");
    expect(a).toMatchObject({ played: 2, won: 0, drawn: 0, lost: 2, points: 0 });
  });

  it("counts every club, and never claims a place nobody climbed to", () => {
    const table = halfTable("epl", "2026/27", ids, season, "second");
    expect(table.rows).toHaveLength(ids.length);
    expect(table.rows.map((r) => r.position)).toEqual([1, 2, 3, 4]);
    expect(table.rows.every((r) => r.movement === 0)).toBe(true);
  });

  it("holds a season nobody has half-time scores for", () => {
    const blind = [match("a", "b", null, [2, 0]), match("c", "d", null, [1, 1])];
    const table = halfTable("epl", "2026/27", ids, blind, "second");
    expect(table.rows.every((r) => r.played === 0)).toBe(true);
  });
});

describe("what the second half is worth", () => {
  const ids = ["a", "b", "c"];

  it("counts the points a club won after the break", () => {
    // 0–1 down at half-time, won 2–1: nought points became three.
    const [row] = turnarounds([match("a", "b", [0, 1], [2, 1])], ["a"]);
    expect(row).toMatchObject({ gained: 3, dropped: 0, net: 3 });
    expect(row.comebacks).toHaveLength(1);
  });

  it("counts the points a club threw away", () => {
    // 2–0 up, drew 2–2: three points became one.
    const rows = turnarounds([match("a", "b", [2, 0], [2, 2])], ids);
    const a = rows.find((r) => r.teamId === "a");
    const b = rows.find((r) => r.teamId === "b");
    expect(a).toMatchObject({ gained: 0, dropped: 2, net: -2 });
    expect(a?.collapses).toHaveLength(1);
    // The other side of the same match is a gain of one.
    expect(b).toMatchObject({ gained: 1, dropped: 0, net: 1 });
  });

  it("says nothing about a match that ended as it stood at the break", () => {
    const rows = turnarounds([match("a", "b", [1, 0], [3, 0])], ids);
    expect(rows.every((r) => r.gained === 0 && r.dropped === 0)).toBe(true);
    expect(rows.every((r) => r.comebacks.length === 0 && r.collapses.length === 0)).toBe(true);
  });

  it("adds a season up, most recent match first", () => {
    const rows = turnarounds(
      [
        match("a", "b", [0, 1], [1, 1]), // a gains 1
        match("c", "a", [1, 0], [1, 2]), // a gains 3, c drops 3
      ],
      ids,
    );
    const a = rows.find((r) => r.teamId === "a");
    expect(a).toMatchObject({ gained: 4, dropped: 0, net: 4 });
    expect(a?.comebacks).toHaveLength(2);
    // Newest first, so the list reads like the rest of the site.
    expect(a?.comebacks[0]).toBe("m" + n);
    expect(rows.find((r) => r.teamId === "c")).toMatchObject({ dropped: 3, net: -3 });
  });

  it("gives every club a row, even one nothing happened to", () => {
    expect(turnarounds([], ids)).toHaveLength(ids.length);
    expect(turnarounds([], ids).every((r) => r.net === 0)).toBe(true);
  });
});
