import { describe, expect, it } from "vitest";
import { worthWatching } from "../data/worth-watching";
import type { Competition, MatchView, StandingRow, Team } from "../types";

const competition = { id: "epl", shortName: "PL" } as Competition;
const team = (id: string, city = id) => ({ id, slug: id, name: id, shortName: id, city }) as Team;

let n = 0;
function fixture(homeId: string, awayId: string, status = "scheduled"): MatchView {
  n++;
  return {
    competition,
    home: team(homeId),
    away: team(awayId),
    match: {
      id: `m${n}`,
      status,
      score: null,
      kickoff: `2026-09-17T1${n}:00:00.000Z`,
    },
  } as MatchView;
}

const row = (teamId: string, position: number, form = "DDDDD"): StandingRow =>
  ({ teamId, position, form: form.split("") }) as StandingRow;

function tables(rows: StandingRow[]) {
  return new Map([["epl", new Map(rows.map((r) => [r.teamId, r]))]]);
}

describe("worth watching", () => {
  it("puts a meeting near the top above one near the bottom", () => {
    const views = [fixture("fourteenth", "seventeenth"), fixture("second", "fourth")];
    const t = tables([
      row("second", 2),
      row("fourth", 4),
      row("fourteenth", 14),
      row("seventeenth", 17),
    ]);
    const teams = new Map(
      ["second", "fourth", "fourteenth", "seventeenth"].map((id) => [id, team(id)]),
    );
    const picks = worthWatching(views, t, teams);
    expect(picks[0].view.home.id).toBe("second");
    expect(picks[0].reason).toEqual({ kind: "top", home: 2, away: 4 });
  });

  it("calls a meeting of two clubs from one city a derby", () => {
    const views = [fixture("united", "city")];
    const t = tables([row("united", 9), row("city", 11)]);
    const teams = new Map([
      ["united", team("united", "Manchester")],
      ["city", team("city", "Manchester")],
    ]);
    expect(worthWatching(views, t, teams)[0].reason).toEqual({
      kind: "derby",
      city: "Manchester",
    });
  });

  it("sells a mid-table fixture on the run both clubs are on", () => {
    const views = [fixture("a", "b")];
    // Oldest first: three wins to finish with.
    const t = tables([row("a", 12, "LDWWW"), row("b", 13, "LDWWW")]);
    const teams = new Map([
      ["a", team("a", "A")],
      ["b", team("b", "B")],
    ]);
    expect(worthWatching(views, t, teams)[0].reason).toEqual({ kind: "form", n: 3 });
  });

  it("does not count a winless run as a run", () => {
    const views = [fixture("a", "b")];
    const t = tables([row("a", 12, "WDDLL"), row("b", 13, "WDDLL")]);
    const teams = new Map([
      ["a", team("a", "A")],
      ["b", team("b", "B")],
    ]);
    expect(worthWatching(views, t, teams)[0].reason.kind).toBe("top");
  });

  it("leaves out matches already played and clubs it has no table for", () => {
    const views = [fixture("second", "fourth", "finished"), fixture("second", "stranger")];
    const t = tables([row("second", 2), row("fourth", 4)]);
    const teams = new Map([
      ["second", team("second")],
      ["fourth", team("fourth")],
    ]);
    expect(worthWatching(views, t, teams)).toEqual([]);
  });

  it("keeps a live match, and returns at most what was asked for", () => {
    const views = [
      fixture("second", "fourth", "live"),
      fixture("first", "third"),
      fixture("fifth", "sixth"),
    ];
    const t = tables([
      row("first", 1),
      row("second", 2),
      row("third", 3),
      row("fourth", 4),
      row("fifth", 5),
      row("sixth", 6),
    ]);
    const teams = new Map(
      ["first", "second", "third", "fourth", "fifth", "sixth"].map((id) => [id, team(id)]),
    );
    expect(worthWatching(views, t, teams, 2)).toHaveLength(2);
    expect(worthWatching(views, t, teams, 9)).toHaveLength(3);
  });
});
