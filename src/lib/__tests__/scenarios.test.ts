import { describe, expect, it } from "vitest";
import { finishedSince, movementSince, positionsFrom, stakes } from "../data/scenarios";
import type { Match, MatchView } from "../types";

const ids = ["a", "b", "c", "d"];
let n = 0;
const played = (home: string, away: string, h: number, a: number, day = "01"): Match =>
  ({
    id: `m${++n}`,
    competitionId: "epl",
    season: "2026/27",
    round: 1,
    kickoff: `2026-09-${day}T15:00:00.000Z`,
    homeTeamId: home,
    awayTeamId: away,
    status: "finished",
    score: { home: h, away: a },
  }) as unknown as Match;

const fixture = (home: string, away: string): Match =>
  ({
    id: `f${++n}`,
    competitionId: "epl",
    season: "2026/27",
    round: 2,
    kickoff: "2026-09-20T15:00:00.000Z",
    homeTeamId: home,
    awayTeamId: away,
    status: "scheduled",
    score: null,
  }) as unknown as Match;

const view = (m: Match): MatchView =>
  ({
    match: m,
    competition: { id: "epl", season: "2026/27" },
    home: { id: m.homeTeamId },
    away: { id: m.awayTeamId },
  }) as unknown as MatchView;

describe("positionsFrom", () => {
  it("puts the table in order of what was played", () => {
    const table = positionsFrom("epl", "2026/27", ids, [
      played("a", "b", 3, 0),
      played("c", "d", 1, 1),
    ]);
    expect(table.get("a")).toBe(1);
    expect(table.get("b")).toBe(4);
  });
});

describe("stakes", () => {
  it("says where each of the three results would leave them", () => {
    // a: 3 points, b: 0, c: 1, d: 1. a v b next.
    const season = [played("a", "b", 1, 0), played("c", "d", 0, 0)];
    const next = fixture("b", "a");
    const out = stakes(view(next), [...season, next], ids);
    expect(out.map((s) => s.outcome)).toEqual(["home", "draw", "away"]);
    const win = out.find((s) => s.outcome === "home")!; // b beat a
    const lose = out.find((s) => s.outcome === "away")!; // a beat b
    // Beating the leader lifts b off the bottom; losing leaves them there.
    expect(win.home).toBeLessThan(lose.home);
    // a is top either way here, but a win keeps them clear.
    expect(lose.away).toBe(1);
  });

  it("has nothing to say about a match already played", () => {
    expect(stakes(view(played("a", "b", 1, 0)), [], ids)).toEqual([]);
  });
});

describe("finishedSince", () => {
  const m = played("a", "b", 1, 0);
  it("counts a match that ended after you left, played or not", () => {
    // Kicked off 15:00, so it is over about 17:10. You left at 16:00 with it
    // still going, or at 13:00 before it started: either way you missed it.
    expect(finishedSince(m, new Date("2026-09-01T16:00:00.000Z"))).toBe(true);
    expect(finishedSince(m, new Date("2026-09-01T13:00:00.000Z"))).toBe(true);
    // Left after the final whistle: nothing to tell you.
    expect(finishedSince(m, new Date("2026-09-01T18:00:00.000Z"))).toBe(false);
  });

  it("does not count one that is not finished", () => {
    const live = { ...m, status: "live" as const };
    expect(finishedSince(live as Match, new Date("2026-09-01T16:00:00.000Z"))).toBe(false);
  });
});

describe("movementSince", () => {
  it("compares the table now with the table as it was", () => {
    const old = [played("a", "b", 3, 0, "01"), played("c", "d", 0, 0, "01")];
    const fresh = [played("b", "c", 5, 0, "10"), played("d", "a", 2, 0, "10")];
    const since = new Date("2026-09-05T00:00:00.000Z");
    const moves = movementSince("epl", "2026/27", ids, [...old, ...fresh], since);
    const by = new Map(moves.map((mv) => [mv.teamId, mv]));
    // b lost 0–3 and then won 5–0: bottom of the table to second, on a goal
    // difference that swung eight goals in an afternoon.
    expect(by.get("b")).toMatchObject({ from: 4, to: 2 });
    // The biggest climb is reported first, whoever it belongs to. Here d and
    // b both went up two, so the order between them is the table's.
    const climb = (mv: (typeof moves)[number]) => mv.from - mv.to;
    expect(climb(moves[0])).toBe(Math.max(...moves.map(climb)));
    expect(climb(moves[moves.length - 1])).toBe(Math.min(...moves.map(climb)));
    // a played and lost, so a moved; nobody who did not move is listed.
    expect(moves.every((mv) => mv.from !== mv.to)).toBe(true);
  });

  it("says nothing happened when nothing has", () => {
    const old = [played("a", "b", 3, 0, "01")];
    expect(movementSince("epl", "2026/27", ids, old, new Date("2026-09-09T00:00:00Z"))).toEqual([]);
  });
});
