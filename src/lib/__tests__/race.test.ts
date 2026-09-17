import { describe, expect, it } from "vitest";
import { movers, race } from "../data/race";
import { seasonArc } from "../data/season-arc";
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

/** Four clubs, three rounds, "a" winning twice and losing once. */
const season = [
  played(1, "a", "b", 2, 0),
  played(1, "c", "d", 1, 0),
  played(2, "d", "a", 3, 0),
  played(2, "c", "b", 2, 1),
  played(3, "a", "c", 1, 0),
  played(3, "b", "d", 1, 1),
];

const run = () => race("epl", "2026/27", ids, season);

describe("race", () => {
  it("draws a line for every club, ordered by where they stand now", () => {
    const r = run();
    expect(r.rounds).toEqual([1, 2, 3]);
    expect(r.lines).toHaveLength(4);
    expect(r.lines.map((l) => l.current)).toEqual([1, 2, 3, 4]);
    // Every club has a point for every round they have played.
    for (const line of r.lines) expect(line.points.map((p) => p.round)).toEqual([1, 2, 3]);
  });

  it("tells the same story as a single club's arc", () => {
    const r = run();
    for (const id of ids) {
      const arc = seasonArc("epl", "2026/27", ids, season, id);
      const line = r.lines.find((l) => l.teamId === id);
      expect(line?.points.map((p) => p.position)).toEqual(arc.map((p) => p.position));
      expect(line?.points.map((p) => p.points)).toEqual(arc.map((p) => p.points));
    }
  });

  it("never puts two clubs in one place", () => {
    for (const round of run().rounds) {
      const places = run()
        .lines.map((l) => l.points.find((p) => p.round === round)?.position)
        .filter((p): p is number => p !== undefined);
      expect(new Set(places).size).toBe(places.length);
    }
  });

  it("starts a club's line at their first match, not the league's", () => {
    const late = [played(1, "a", "b", 1, 0), played(2, "c", "d", 0, 1), played(3, "d", "a", 2, 2)];
    const r = race("epl", "2026/27", ids, late);
    expect(r.lines.find((l) => l.teamId === "d")?.points.map((p) => p.round)).toEqual([2, 3]);
    expect(r.lines.find((l) => l.teamId === "a")?.points.map((p) => p.round)).toEqual([1, 2, 3]);
  });

  it("holds an empty season without falling over", () => {
    const r = race("epl", "2026/27", ids, []);
    expect(r.lines).toEqual([]);
    expect(r.rounds).toEqual([]);
    expect(r.places).toBe(ids.length);
    expect(movers(r)).toEqual({ up: [], down: [] });
  });
});

describe("movers", () => {
  it("reports climbs and falls over the window, biggest first", () => {
    const r = run();
    const m = movers(r, 5);
    // Over the whole (three-round) season: "c" led after two and finished
    // second, "d" was last after one and climbed.
    expect(m.up.every((x) => x.change > 0)).toBe(true);
    expect(m.down.every((x) => x.change < 0)).toBe(true);
    for (const x of [...m.up, ...m.down]) expect(x.change).toBe(x.from - x.to);
    expect(m.up.map((x) => x.change)).toEqual([...m.up.map((x) => x.change)].sort((p, q) => q - p));
  });

  it("measures only the window it was given", () => {
    const r = run();
    // One round back: only what changed between round 2 and round 3.
    const recent = movers(r, 1);
    for (const x of [...recent.up, ...recent.down]) {
      const line = r.lines.find((l) => l.teamId === x.teamId);
      expect(x.from).toBe(line?.points[line.points.length - 2].position);
    }
  });

  it("leaves out a club that has not moved, and honours the limit", () => {
    const steady = [
      played(1, "a", "b", 5, 0),
      played(2, "a", "b", 5, 0),
      played(3, "a", "b", 5, 0),
    ];
    const r = race("epl", "2026/27", ["a", "b"], steady);
    expect(movers(r, 5)).toEqual({ up: [], down: [] });
    expect(movers(run(), 5, 1).up.length).toBeLessThanOrEqual(1);
  });
});
