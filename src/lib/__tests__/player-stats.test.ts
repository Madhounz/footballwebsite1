import { describe, expect, it } from "vitest";
import { playerSeasonStats } from "../data/player-stats";
import type { ScorerRow } from "../types";

const row = (over: Partial<ScorerRow>): ScorerRow => ({
  playerId: "p",
  teamId: "arsenal",
  goals: 0,
  assists: 0,
  penalties: 0,
  appearances: 0,
  ...over,
});

const base = { playerId: "p", teamId: "arsenal", chart: [], counted: null, appearances: 0 };

describe("a player's season", () => {
  it("takes the provider's chart when there is one, across every competition", () => {
    const s = playerSeasonStats({
      ...base,
      chart: [
        row({ goals: 8, assists: 3, penalties: 2, appearances: 10 }),
        row({ goals: 2, assists: 1, penalties: 0, appearances: 3 }),
      ],
      holdsDetail: false,
    });
    expect(s).toMatchObject({ goals: 10, assists: 4, penalties: 2, appearances: 13 });
    expect(s.source).toBe("provider");
  });

  it("prefers appearances we can point at a line-up for", () => {
    const s = playerSeasonStats({
      ...base,
      chart: [row({ goals: 8, appearances: 10 })],
      appearances: 9,
      holdsDetail: true,
    });
    expect(s.appearances).toBe(9);
  });

  it("falls back to our own count where there is no chart row", () => {
    const s = playerSeasonStats({
      ...base,
      counted: row({ goals: 1, assists: 2, penalties: 0, appearances: 4 }),
      appearances: 4,
      holdsDetail: true,
    });
    expect(s).toMatchObject({ goals: 1, assists: 2, appearances: 4, source: "matches" });
  });

  it("says it knows nothing rather than saying nought", () => {
    // No chart row and no match detail at all: the player may have scored
    // twenty. "None" is a fact about us, zero would be a claim about him.
    const s = playerSeasonStats({ ...base, holdsDetail: false });
    expect(s.source).toBe("none");
    expect(s).toMatchObject({ goals: 0, assists: 0, appearances: 0 });
  });

  it("is a real nought when we do hold the matches", () => {
    const s = playerSeasonStats({ ...base, appearances: 6, holdsDetail: true });
    expect(s.source).toBe("matches");
    expect(s.goals).toBe(0);
    expect(s.appearances).toBe(6);
  });

  it("never disagrees with the chart it was given", () => {
    const chart = [row({ goals: 4, assists: 4, penalties: 1, appearances: 7 })];
    const s = playerSeasonStats({ ...base, chart, counted: row({ goals: 99 }), holdsDetail: true });
    // Our own count is always short on a free plan, so the chart wins — the
    // same precedence the top scorers table uses.
    expect(s.goals).toBe(4);
  });
});
