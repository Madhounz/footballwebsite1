import { describe, expect, it } from "vitest";
import { goalsPerMatch, weekReport } from "../data/week";
import type { ISODate } from "../dates";
import type { MatchView } from "../types";

let n = 0;
function played(
  home: string,
  away: string,
  score: [number, number],
  half?: [number, number],
  competitionId = "epl",
): MatchView {
  n++;
  return {
    competition: { id: competitionId, color: "#000" },
    home: { id: home, slug: home },
    away: { id: away, slug: away },
    match: {
      id: `m${n}`,
      slug: `${home}-vs-${away}`,
      kickoff: `2026-09-1${(n % 9) + 1}T15:00:00.000Z`,
      status: "finished",
      score: { home: score[0], away: score[1] },
      halfTimeScore: half ? { home: half[0], away: half[1] } : null,
    },
  } as unknown as MatchView;
}

const scheduled = (home: string, away: string): MatchView =>
  ({
    competition: { id: "epl", color: "#000" },
    home: { id: home, slug: home },
    away: { id: away, slug: away },
    match: { id: `s${++n}`, kickoff: "2026-09-20T15:00:00.000Z", status: "scheduled", score: null },
  }) as unknown as MatchView;

const day = (date: string, views: MatchView[]) => ({ date: date as ISODate, views });
const table = (...rows: [string, number][]) => new Map([["epl", new Map(rows)]]);

describe("weekReport", () => {
  it("counts only what was played", () => {
    const r = weekReport(
      [day("2026-09-14", [played("a", "b", [2, 1]), scheduled("c", "d")])],
      table(),
    );
    expect(r.played).toBe(1);
    expect(r.goals).toBe(3);
    expect(r.homeWins).toBe(1);
    expect(r.byDay).toEqual([{ date: "2026-09-14", matches: 1, goals: 3 }]);
  });

  it("splits results three ways and counts clean sheets", () => {
    const r = weekReport(
      [
        day("2026-09-14", [played("a", "b", [1, 0]), played("c", "d", [0, 0])]),
        day("2026-09-15", [played("e", "f", [1, 3])]),
      ],
      table(),
    );
    expect([r.homeWins, r.draws, r.awayWins]).toEqual([1, 1, 1]);
    // 1–0 keeps one, 0–0 keeps two, 1–3 keeps none.
    expect(r.cleanSheets).toBe(3);
    expect(r.goalless).toBe(1);
    expect(goalsPerMatch(r)).toBe(1.7);
  });

  it("finds a side that was behind at half time and won", () => {
    const r = weekReport(
      [
        day("2026-09-14", [
          played("a", "b", [3, 2], [0, 2]), // home came from two down
          played("c", "d", [2, 0], [1, 0]), // led all the way
          played("e", "f", [1, 2], [1, 0]), // away came from one down
        ]),
      ],
      table(),
    );
    expect(r.comebacks.map((p) => [p.view.home.id, p.value])).toEqual([
      ["a", 2],
      ["e", 1],
    ]);
  });

  it("does not call a draw a comeback", () => {
    const r = weekReport([day("2026-09-14", [played("a", "b", [2, 2], [0, 2])])], table());
    expect(r.comebacks).toEqual([]);
  });

  it("keeps a three-goal win and ignores a two-goal one", () => {
    const r = weekReport(
      [day("2026-09-14", [played("a", "b", [4, 0]), played("c", "d", [2, 0])])],
      table(),
    );
    expect(r.thrashings.map((p) => [p.view.home.id, p.value])).toEqual([["a", 4]]);
  });

  it("keeps a match of five goals or more", () => {
    const r = weekReport(
      [day("2026-09-14", [played("a", "b", [3, 2]), played("c", "d", [2, 2])])],
      table(),
    );
    expect(r.thrillers.map((p) => [p.view.home.id, p.value])).toEqual([["a", 5]]);
  });

  it("orders upsets by how far below the winner was, and ignores the trivial", () => {
    const r = weekReport(
      [
        day("2026-09-14", [
          played("bottom", "top", [1, 0]), // 18th beat 2nd
          played("eighth", "third", [1, 0]), // five places
          played("fourth", "second", [1, 0]), // two places: not worth calling anything
          played("top2", "tenth", [3, 0]), // the table held; not an upset at all
        ]),
      ],
      table(
        ["bottom", 18],
        ["top", 2],
        ["eighth", 8],
        ["third", 3],
        ["fourth", 4],
        ["second", 2],
        ["top2", 1],
        ["tenth", 10],
      ),
    );
    expect(r.upsets.map((p) => [p.view.home.id, p.value])).toEqual([
      ["bottom", 16],
      ["eighth", 5],
    ]);
  });

  it("will not measure an upset across two tables it cannot compare", () => {
    // A cup tie in a competition we hold no table for.
    const r = weekReport(
      [day("2026-09-14", [played("minnow", "giant", [1, 0], undefined, "cup")])],
      table(["minnow", 18], ["giant", 1]),
    );
    expect(r.upsets).toEqual([]);
  });

  it("holds the sections to the limit, biggest first", () => {
    const r = weekReport(
      [
        day("2026-09-14", [
          played("a", "b", [5, 0]),
          played("c", "d", [3, 0]),
          played("e", "f", [7, 0]),
          played("g", "h", [4, 0]),
        ]),
      ],
      table(),
      2,
    );
    expect(r.thrashings.map((p) => p.value)).toEqual([7, 5]);
  });

  it("survives a week with no football in it", () => {
    const r = weekReport([day("2026-09-14", []), day("2026-09-15", [])], table());
    expect(r.played).toBe(0);
    expect(goalsPerMatch(r)).toBeNull();
    expect(r.from).toBe("2026-09-14");
    expect(r.to).toBe("2026-09-15");
    expect([r.comebacks, r.thrashings, r.thrillers, r.upsets]).toEqual([[], [], [], []]);
  });
});
