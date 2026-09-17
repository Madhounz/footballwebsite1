import { describe, expect, it } from "vitest";
import { resultsGrid } from "../data/grid";
import type { MatchView } from "../types";

const team = (id: string) => ({ id, slug: id, name: id, shortName: id, code: id.toUpperCase() });

let n = 0;
function view(home: string, away: string, score: [number, number] | null, status = "finished") {
  n++;
  return {
    competition: { id: "epl" },
    home: team(home),
    away: team(away),
    match: {
      id: `m${n}`,
      slug: `${home}-vs-${away}-2026-09-${String(n).padStart(2, "0")}`,
      status,
      score: score ? { home: score[0], away: score[1] } : null,
      kickoff: `2026-09-${String(n).padStart(2, "0")}T14:00:00.000Z`,
    },
  } as unknown as MatchView;
}

const ids = ["a", "b", "c"];

describe("the results grid", () => {
  it("puts each result in the home club's row", () => {
    const g = resultsGrid([view("a", "b", [2, 1]), view("b", "a", [0, 0])], ids);
    expect(g.cells.get("a:b")).toMatchObject({ home: 2, away: 1, result: "W" });
    // The reverse fixture is its own cell, and a draw is a draw either way.
    expect(g.cells.get("b:a")).toMatchObject({ home: 0, away: 0, result: "D" });
    expect(g.played).toBe(2);
  });

  it("reads the result from the home club's point of view", () => {
    const g = resultsGrid([view("a", "b", [0, 3])], ids);
    expect(g.cells.get("a:b")?.result).toBe("L");
  });

  it("leaves a fixture still to come out of the square", () => {
    const g = resultsGrid([view("a", "b", null, "scheduled"), view("a", "c", [1, 1])], ids);
    expect(g.cells.has("a:b")).toBe(false);
    expect(g.played).toBe(1);
  });

  it("ignores a club the table does not hold", () => {
    const g = resultsGrid([view("a", "stranger", [4, 0])], ids);
    expect(g.cells.size).toBe(0);
  });

  it("keeps the later match when a pairing somehow has two", () => {
    const first = view("a", "b", [1, 0]);
    const second = view("a", "b", [3, 3]);
    expect(resultsGrid([first, second], ids).cells.get("a:b")).toMatchObject({ home: 3, away: 3 });
    // Order of arrival must not change the answer.
    expect(resultsGrid([second, first], ids).cells.get("a:b")).toMatchObject({ home: 3, away: 3 });
  });

  it("holds a season nobody has played yet", () => {
    const g = resultsGrid([], ids);
    expect(g.played).toBe(0);
    expect(g.teamIds).toEqual(ids);
  });
});
