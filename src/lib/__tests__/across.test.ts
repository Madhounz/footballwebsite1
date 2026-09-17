import { describe, expect, it } from "vitest";
import { goalsAcross } from "../data/across";
import type { ScorerRow } from "../types";

const row = (playerId: string, teamId: string, goals: number, assists = 0): ScorerRow => ({
  playerId,
  teamId,
  goals,
  assists,
  penalties: 0,
  appearances: 10,
});

describe("goalsAcross", () => {
  it("adds a player's goals across every chart he appears in", () => {
    const out = goalsAcross([
      { competitionId: "epl", rows: [row("haaland", "mancity", 14, 3)] },
      { competitionId: "ucl", rows: [row("haaland", "mancity", 5, 1)] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].goals).toBe(19);
    expect(out[0].assists).toBe(4);
    expect(out[0].appearances).toBe(20);
    expect(out[0].parts.map((p) => [p.competitionId, p.goals])).toEqual([
      ["epl", 14],
      ["ucl", 5],
    ]);
  });

  it("keeps a player who plays in one competition exactly as he was", () => {
    const out = goalsAcross([{ competitionId: "laliga", rows: [row("lewa", "barcelona", 11, 2)] }]);
    expect(out[0]).toMatchObject({ goals: 11, assists: 2, teamId: "barcelona" });
    expect(out[0].parts).toHaveLength(1);
  });

  it("files a transferred player under the club he scored most for", () => {
    const out = goalsAcross([
      { competitionId: "epl", rows: [row("someone", "arsenal", 3)] },
      { competitionId: "seriea", rows: [row("someone", "inter", 9)] },
    ]);
    expect(out[0].teamId).toBe("inter");
    expect(out[0].parts[0].competitionId).toBe("seriea");
  });

  it("orders by goals, then assists, then fewer appearances", () => {
    const out = goalsAcross([
      {
        competitionId: "epl",
        rows: [row("a", "t", 9, 1), row("b", "t", 9, 4), row("c", "t", 12)],
      },
    ]);
    expect(out.map((r) => r.playerId)).toEqual(["c", "b", "a"]);
  });

  it("leaves out a chart row that is only there for its assists", () => {
    const out = goalsAcross([
      { competitionId: "epl", rows: [row("scorer", "t", 4), row("creator", "t", 0, 9)] },
    ]);
    expect(out.map((r) => r.playerId)).toEqual(["scorer"]);
  });

  it("respects the limit", () => {
    const rows = Array.from({ length: 30 }, (_, i) => row(`p${i}`, "t", 30 - i));
    expect(goalsAcross([{ competitionId: "epl", rows }], 5)).toHaveLength(5);
  });
});
