import { describe, expect, it } from "vitest";
import { decide, matchKey, reconcileMatches } from "../pipeline/reconcile";
import type { ProviderMatch, ProviderRecord } from "../pipeline/types";

const W = { "football-data": 0.8, "api-football": 0.7, other: 0.5 };

function rec(provider: string, over: Partial<ProviderMatch> = {}): ProviderRecord<ProviderMatch> {
  return {
    provider,
    externalId: "1",
    value: {
      id: "",
      competitionId: "epl",
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
  };
}

describe("decide", () => {
  it("returns consensus when all providers agree", () => {
    expect(decide({ a: { home: 1, away: 0 }, b: { home: 1, away: 0 } }, W)).toMatchObject({
      resolvedBy: "consensus",
      confidence: 1,
    });
  });
  it("ignores key order when comparing objects", () => {
    expect(decide({ a: { home: 1, away: 0 }, b: { away: 0, home: 1 } }, W).resolvedBy).toBe(
      "consensus",
    );
  });
  it("picks the majority and reports its weight share", () => {
    const r = decide({ "football-data": 2, "api-football": 3, other: 3 }, W);
    expect(r).toMatchObject({ value: 3, resolvedBy: "majority" });
    expect(r.confidence).toBeCloseTo(0.6, 1);
  });
  it("falls back to weight with low confidence on a tie", () => {
    const r = decide({ "football-data": 2, "api-football": 3 }, W);
    expect(r).toMatchObject({ value: 2, resolvedBy: "weight" });
    expect(r.confidence).toBeLessThanOrEqual(0.5);
  });
  it("treats an empty value from every provider as agreement, not a conflict", () => {
    expect(decide({ a: null, b: null }, W)).toMatchObject({
      value: null,
      resolvedBy: "consensus",
      confidence: 1,
    });
    expect(decide({ a: null }, W)).toMatchObject({ value: null, resolvedBy: "consensus" });
    expect(decide({}, W).resolvedBy).toBe("unresolved");
  });
  it("does not flag unplayed matches from a single provider", () => {
    const { matches, needsReview } = reconcileMatches(
      [rec("football-data", { status: "scheduled", score: null, halfTimeScore: null })],
      W,
    );
    expect(matches[0].conflicts).toHaveLength(0);
    expect(needsReview).toHaveLength(0);
  });
  it("treats a single provider as weak consensus", () => {
    expect(decide({ a: 1 }, W)).toMatchObject({
      value: 1,
      resolvedBy: "consensus",
      confidence: 0.6,
    });
  });
});

describe("reconcileMatches", () => {
  it("merges agreeing providers into one match with full confidence", () => {
    const { matches, needsReview } = reconcileMatches(
      [rec("football-data"), rec("api-football")],
      W,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].confidence).toBe(1);
    expect(matches[0].conflicts).toHaveLength(0);
    expect(needsReview).toHaveLength(0);
    expect(matches[0].id).toBe(matchKey(rec("x").value));
  });
  it("quarantines a disputed scoreline instead of sending it to a model", () => {
    const { matches, needsReview } = reconcileMatches(
      [rec("football-data"), rec("api-football", { score: { home: 2, away: 2 } })],
      W,
    );
    // the primary source's value stands, deterministically
    expect(matches[0].value.score).toEqual({ home: 2, away: 1 });
    expect(matches[0].confidence).toBeLessThan(0.75);
    // and the disagreement is flagged for review, never handed to the validator
    expect(matches[0].disputedFields).toEqual(["score"]);
    expect(needsReview).toEqual([]);
  });

  it("does not flag a mid-match difference, which is lag rather than disagreement", () => {
    const { matches } = reconcileMatches(
      [
        rec("football-data", { status: "live", phase: "2H" }),
        rec("api-football", { status: "live", phase: "2H", score: { home: 2, away: 2 } }),
      ],
      W,
    );
    expect(matches[0].disputedFields).toEqual([]);
  });

  it("still asks the validator about non-factual disagreements", () => {
    const { matches, needsReview } = reconcileMatches(
      [rec("football-data"), rec("api-football", { kickoff: "2026-09-19T14:05:00.000Z" })],
      W,
    );
    expect(needsReview.map((c) => c.field)).toEqual(["kickoff"]);
    expect(matches[0].disputedFields).toEqual([]);
  });
  it("keeps a kickoff shift of a few minutes as a conflict, not a new match", () => {
    const { matches } = reconcileMatches(
      [rec("football-data"), rec("api-football", { kickoff: "2026-09-19T14:05:00.000Z" })],
      W,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].conflicts.map((c) => c.field)).toContain("kickoff");
  });
  it("unions events across providers without duplicates", () => {
    const e = {
      id: "",
      matchId: "",
      minute: 12,
      teamId: "arsenal",
      type: "goal" as const,
      playerId: "p1",
    };
    const { matches } = reconcileMatches(
      [
        rec("football-data", { events: [e] }),
        rec("api-football", { events: [e, { ...e, minute: 70 }] }),
      ],
      W,
    );
    expect(matches[0].value.events).toHaveLength(2);
  });
});

describe("AIValidator guardrails", () => {
  it("refuses to decide a factual field even when handed one directly", async () => {
    const { AIValidator } = await import("../pipeline/ai-validator");
    // The client is never reached: the guard runs before any request.
    const validator = new AIValidator({ client: {} as never });
    await expect(
      validator.resolveConflicts([
        {
          entityType: "match",
          entityId: "x",
          field: "score",
          values: { a: { home: 2, away: 1 }, b: { home: 2, away: 2 } },
          context: {},
        },
      ]),
    ).rejects.toThrow(/may not decide factual fields/);
  });
});
