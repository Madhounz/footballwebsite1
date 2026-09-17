import { describe, expect, it } from "vitest";
import { arcExtremes, seasonArc } from "../data/season-arc";
import type { Match } from "../types";

const ids = ["a", "b", "c", "d"];

let n = 0;
function played(round: number, home: string, away: string, hg: number, ag: number): Match {
  n++;
  return {
    id: `m${n}`,
    competitionId: "epl",
    season: "2026/27",
    round,
    kickoff: `2026-09-${String(round).padStart(2, "0")}T14:00:00.000Z`,
    status: "finished",
    homeTeamId: home,
    awayTeamId: away,
    score: { home: hg, away: ag },
  } as Match;
}

const scheduled = (round: number, home: string, away: string) =>
  ({ ...played(round, home, away, 0, 0), status: "scheduled", score: null }) as Match;

describe("season arc", () => {
  const matches = [
    // Round 1: a beat b, c beat d.
    played(1, "a", "b", 2, 0),
    played(1, "c", "d", 1, 0),
    // Round 2: a lose heavily, c win again.
    played(2, "d", "a", 3, 0),
    played(2, "c", "b", 2, 1),
    // Round 3: a win, c lose.
    played(3, "a", "c", 1, 0),
    played(3, "b", "d", 1, 1),
  ];

  it("follows a club up and down the table, round by round", () => {
    const arc = seasonArc("epl", "2026/27", ids, matches, "a");
    expect(arc.map((p) => p.round)).toEqual([1, 2, 3]);
    // Top on goal difference after one, then beaten and passed, then back up.
    expect(arc.map((p) => p.position)).toEqual([1, 3, 2]);
    expect(arc.map((p) => p.result)).toEqual(["W", "L", "W"]);
    expect(arc.map((p) => p.points)).toEqual([3, 3, 6]);
    expect(arc[2].played).toBe(3);
    expect(arc[0].matchId).toBe(matches[0].id);
  });

  it("agrees with the table it came from", () => {
    // The last point is the club's place in the finished table.
    for (const id of ids) {
      const arc = seasonArc("epl", "2026/27", ids, matches, id);
      const last = arc[arc.length - 1];
      const table = seasonArc("epl", "2026/27", ids, matches, id);
      expect(last.position).toBe(table[table.length - 1].position);
    }
    // Every club has a place, and no two clubs share one in the same round.
    const round3 = ids.map((id) => seasonArc("epl", "2026/27", ids, matches, id)[2].position);
    expect(new Set(round3).size).toBe(ids.length);
  });

  it("starts when the club does, not when the season does", () => {
    // "d" sits out the first round entirely; their line starts at round 2.
    const late = [played(1, "a", "b", 1, 0), played(2, "c", "d", 0, 1), played(3, "d", "a", 2, 2)];
    const arc = seasonArc("epl", "2026/27", ids, late, "d");
    expect(arc.map((p) => p.round)).toEqual([2, 3]);
  });

  it("keeps a round the club did not play, once they have started", () => {
    const withGap = [
      played(1, "a", "b", 1, 0),
      played(2, "c", "d", 1, 1), // a's round 2 match is postponed
      played(3, "a", "c", 1, 0),
    ];
    const arc = seasonArc("epl", "2026/27", ids, withGap, "a");
    expect(arc.map((p) => p.round)).toEqual([1, 2, 3]);
    expect(arc[1].result).toBeNull();
    expect(arc[1].matchId).toBeNull();
  });

  it("ignores matches that have not been played", () => {
    const arc = seasonArc("epl", "2026/27", ids, [...matches, scheduled(4, "a", "b")], "a");
    expect(arc).toHaveLength(3);
  });

  it("reports the high and low of a season", () => {
    const arc = seasonArc("epl", "2026/27", ids, matches, "a");
    expect(arcExtremes(arc)).toEqual({ best: 1, worst: 3, now: 2 });
    expect(arcExtremes([])).toBeNull();
  });
});
