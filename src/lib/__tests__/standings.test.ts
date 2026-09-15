import { describe, expect, it } from "vitest";
import { computeScorers, computeStandings } from "../data/standings";
import type { Match, MatchEvent } from "../types";

function m(id: string, round: number, home: string, away: string, h: number, a: number): Match {
  return {
    id,
    competitionId: "x",
    season: "s",
    round,
    kickoff: `2026-09-${String(round).padStart(2, "0")}T14:00:00.000Z`,
    homeTeamId: home,
    awayTeamId: away,
    status: "finished",
    phase: "FT",
    minute: null,
    score: { home: h, away: a },
    halfTimeScore: null,
  };
}

describe("computeStandings", () => {
  it("orders by points, goal difference, goals for", () => {
    const s = computeStandings(
      "x",
      "s",
      ["a", "b", "c", "d"],
      [
        m("1", 1, "a", "b", 3, 0),
        m("2", 1, "c", "d", 1, 0),
        m("3", 2, "b", "c", 0, 0),
        m("4", 2, "d", "a", 2, 2),
      ],
    );
    expect(s.rows.map((r) => r.teamId)).toEqual(["a", "c", "d", "b"]);
    expect(s.rows[0]).toMatchObject({ points: 4, played: 2, goalDifference: 3, form: ["W", "D"] });
  });
  it("ignores unfinished matches", () => {
    const live: Match = { ...m("1", 1, "a", "b", 1, 0), status: "live" };
    const s = computeStandings("x", "s", ["a", "b"], [live]);
    expect(s.rows.every((r) => r.played === 0)).toBe(true);
  });
  it("reports movement against the previous round", () => {
    const s = computeStandings(
      "x",
      "s",
      ["a", "b"],
      [m("1", 1, "a", "b", 1, 0), m("2", 2, "b", "a", 3, 0)],
    );
    expect(s.rows[0].teamId).toBe("b");
    expect(s.rows[0].movement).toBe(1);
  });
});

describe("computeScorers", () => {
  it("counts goals, penalties and assists", () => {
    const ev = (type: MatchEvent["type"], playerId: string, rel?: string): MatchEvent => ({
      id: "",
      matchId: "m",
      minute: 1,
      teamId: "a",
      type,
      playerId,
      relatedPlayerId: rel,
    });
    const rows = computeScorers(
      [
        ev("goal", "p1", "p2"),
        ev("penalty", "p1"),
        ev("goal", "p2"),
        ev("yellow", "p1"),
        ev("own_goal", "p3"),
      ],
      new Map([["p1", 3]]),
    );
    expect(rows[0]).toMatchObject({ playerId: "p1", goals: 2, penalties: 1, appearances: 3 });
    expect(rows[1]).toMatchObject({ playerId: "p2", goals: 1, assists: 1 });
    expect(rows.find((r) => r.playerId === "p3")).toBeUndefined();
  });
});
