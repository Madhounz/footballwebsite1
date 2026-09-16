import { describe, expect, it } from "vitest";
import { playerMatchFrom } from "../data/player-matches";
import type { MatchEvent, MatchView } from "../types";

const view = (over: Partial<MatchView["match"]> = {}): MatchView =>
  ({
    match: {
      id: "m1",
      slug: "arsenal-vs-chelsea-2026-09-19",
      competitionId: "epl",
      season: "2026/27",
      round: 5,
      kickoff: "2026-09-19T14:00:00.000Z",
      homeTeamId: "arsenal",
      awayTeamId: "chelsea",
      status: "finished",
      phase: "FT",
      minute: null,
      score: { home: 2, away: 1 },
      halfTimeScore: { home: 1, away: 0 },
      ...over,
    },
    competition: { id: "epl", color: "#000", name: "Premier League" },
    home: { id: "arsenal" },
    away: { id: "chelsea" },
  }) as unknown as MatchView;

const event = (over: Partial<MatchEvent>): MatchEvent =>
  ({
    id: "e",
    matchId: "m1",
    minute: 1,
    teamId: "arsenal",
    type: "goal",
    playerId: null,
    relatedPlayerId: null,
    ...over,
  }) as MatchEvent;

describe("playerMatchFrom", () => {
  it("counts a starter who played the whole match", () => {
    const m = playerMatchFrom(
      "saka",
      view(),
      ["saka", "odegaard"],
      [event({ minute: 12, type: "goal", playerId: "saka", relatedPlayerId: "odegaard" })],
    );
    expect(m).toMatchObject({ started: true, minutes: 90, goals: 1, assists: 0, offMinute: null });
  });

  it("does not mistake a goal for being substituted off", () => {
    // The player field of a goal names the scorer; only a substitution takes
    // anyone off, and reading the two the same way once cost us the minutes.
    const m = playerMatchFrom(
      "saka",
      view(),
      ["saka"],
      [event({ minute: 30, type: "goal", playerId: "saka" })],
    );
    expect(m?.minutes).toBe(90);
  });

  it("measures a substitute from the minute they came on", () => {
    const m = playerMatchFrom(
      "jesus",
      view(),
      ["saka"],
      [event({ minute: 63, type: "substitution", playerId: "saka", relatedPlayerId: "jesus" })],
    );
    expect(m).toMatchObject({ started: false, onMinute: 63, minutes: 27 });
  });

  it("stops a starter's clock when they are replaced", () => {
    const m = playerMatchFrom(
      "saka",
      view(),
      ["saka"],
      [event({ minute: 63, type: "substitution", playerId: "saka", relatedPlayerId: "jesus" })],
    );
    expect(m).toMatchObject({ started: true, offMinute: 63, minutes: 63 });
  });

  it("counts assists, cards and own goals separately from goals", () => {
    const m = playerMatchFrom(
      "saka",
      view(),
      ["saka"],
      [
        event({ minute: 10, type: "goal", playerId: "odegaard", relatedPlayerId: "saka" }),
        event({ minute: 20, type: "own_goal", playerId: "saka" }),
        event({ minute: 30, type: "yellow", playerId: "saka" }),
        event({ minute: 80, type: "second_yellow", playerId: "saka" }),
      ],
    );
    expect(m).toMatchObject({ goals: 0, assists: 1, ownGoals: 1, yellow: 1, red: true });
  });

  it("is not an appearance when the player neither started nor came on", () => {
    expect(playerMatchFrom("nketiah", view(), ["saka"], [])).toBeNull();
  });

  it("uses the live minute while the match is still being played", () => {
    const live = view({ status: "live", minute: 55, phase: "2H" });
    expect(playerMatchFrom("saka", live, ["saka"], [])?.minutes).toBe(55);
  });
});
