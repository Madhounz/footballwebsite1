import { describe, expect, it } from "vitest";
import { seasonFacts } from "../data/season-facts";
import type { MatchView, StandingRow } from "../types";

let n = 0;
const view = (home: string, away: string, score: [number, number] | null, day = ++n): MatchView =>
  ({
    match: {
      id: `m${day}`,
      slug: `${home}-vs-${away}`,
      competitionId: "epl",
      season: "2026/27",
      round: day,
      kickoff: `2026-09-${String(day).padStart(2, "0")}T14:00:00.000Z`,
      homeTeamId: home,
      awayTeamId: away,
      status: score ? "finished" : "scheduled",
      phase: score ? "FT" : "NS",
      minute: null,
      score: score ? { home: score[0], away: score[1] } : null,
      halfTimeScore: null,
    },
    competition: { id: "epl" },
    home: { id: home },
    away: { id: away },
  }) as unknown as MatchView;

const row = (teamId: string, goalsFor: number, goalsAgainst: number, played = 5): StandingRow =>
  ({ teamId, goalsFor, goalsAgainst, played }) as StandingRow;

describe("seasonFacts", () => {
  const views = [
    view("arsenal", "chelsea", [3, 0]),
    view("chelsea", "spurs", [1, 1]),
    view("spurs", "arsenal", [2, 4]),
    view("arsenal", "spurs", [5, 0]),
    view("chelsea", "arsenal", null),
  ];
  const table = [row("arsenal", 12, 2), row("chelsea", 1, 4), row("spurs", 3, 10)];

  it("counts only matches that have been played", () => {
    const f = seasonFacts(views, table);
    expect(f.played).toBe(4);
    expect(f.goals).toBe(16);
    expect(f.goalsPerMatch).toBe(4);
  });

  it("splits results between home, draw and away", () => {
    expect(seasonFacts(views, table).outcomes).toEqual({ homeWins: 2, draws: 1, awayWins: 1 });
  });

  it("takes the widest margin, and the most goals for the highest scoring", () => {
    const f = seasonFacts(views, table);
    expect(f.biggestWin?.match.score).toEqual({ home: 5, away: 0 });
    expect(f.highestScoring?.match.score).toEqual({ home: 2, away: 4 });
  });

  it("reads best attack and defence off the table", () => {
    const f = seasonFacts(views, table);
    expect(f.bestAttack).toEqual({ teamId: "arsenal", goals: 12 });
    expect(f.bestDefence).toEqual({ teamId: "arsenal", conceded: 2 });
  });

  it("counts a clean sheet for the side that conceded nothing", () => {
    // Arsenal kept two (3-0, 5-0); Spurs and Chelsea none.
    expect(seasonFacts(views, table).cleanSheets).toEqual([{ teamId: "arsenal", count: 2 }]);
  });

  it("says nothing rather than something wrong before a ball is kicked", () => {
    const f = seasonFacts([view("arsenal", "chelsea", null)], [row("arsenal", 0, 0, 0)]);
    expect(f).toMatchObject({
      played: 0,
      goals: 0,
      goalsPerMatch: 0,
      bestAttack: null,
      biggestWin: null,
      cleanSheets: [],
    });
  });

  it("does not call a draw the biggest win", () => {
    const draws = [view("arsenal", "chelsea", [2, 2]), view("chelsea", "arsenal", [0, 0])];
    expect(seasonFacts(draws, table).biggestWin).toBeNull();
  });
});
