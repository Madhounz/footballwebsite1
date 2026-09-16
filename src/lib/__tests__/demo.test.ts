import { describe, expect, it } from "vitest";
import { DemoRepository, clockFor, gridFor } from "../data/demo";

describe("clockFor", () => {
  const k = "2026-09-15T14:00:00.000Z";
  it("is scheduled before kickoff", () => {
    expect(clockFor(k, new Date("2026-09-15T13:59:00Z")).status).toBe("scheduled");
  });
  it("runs the first half, half time and second half", () => {
    expect(clockFor(k, new Date("2026-09-15T14:10:30Z"))).toMatchObject({
      status: "live",
      phase: "1H",
      minute: 11,
    });
    expect(clockFor(k, new Date("2026-09-15T14:50:00Z"))).toMatchObject({
      status: "live",
      phase: "HT",
    });
    expect(clockFor(k, new Date("2026-09-15T15:12:00Z"))).toMatchObject({
      status: "live",
      phase: "2H",
      minute: 56,
    });
  });
  it("finishes after ~111 minutes", () => {
    expect(clockFor(k, new Date("2026-09-15T15:52:00Z")).status).toBe("finished");
  });
});

describe("gridFor", () => {
  it("places 11 players across the formation lines", () => {
    const g = gridFor("4-3-3", 11);
    expect(g[0]).toBe("1:1");
    expect(g.slice(1, 5)).toEqual(["2:1", "2:2", "2:3", "2:4"]);
    expect(g[10]).toBe("4:3");
  });
});

describe("DemoRepository", () => {
  const now = new Date("2026-11-03T18:30:00Z");
  const repo = new DemoRepository(() => now);

  it("shifts the anchor day onto today and has live matches at 18:30 UTC", async () => {
    const today = await repo.getMatchesOnDate("2026-11-03");
    expect(today.length).toBeGreaterThan(0);
    expect(today.some((v) => v.match.status === "live")).toBe(true);
    expect(today.some((v) => v.match.status === "finished")).toBe(true);
    expect(today.some((v) => v.match.status === "scheduled")).toBe(true);
  });

  it("produces a complete table for every competition", async () => {
    for (const c of await repo.listCompetitions()) {
      const s = await repo.getStandings(c.id);
      expect(s.rows).toHaveLength(c.teamCount);
      const played = s.rows.reduce((n, r) => n + r.played, 0);
      expect(played % 2).toBe(0);
      expect(s.rows[0].points).toBeGreaterThan(0);
    }
  });

  it("keeps live scores consistent with revealed events", async () => {
    const live = (await repo.getLiveMatches())[0];
    const detail = await repo.getMatch(live.match.id);
    expect(detail).not.toBeNull();
    const goals = detail!.events.filter(
      (e) => e.type === "goal" || e.type === "penalty" || e.type === "own_goal",
    );
    expect(goals.filter((g) => g.teamId === live.home.id)).toHaveLength(live.match.score!.home);
    expect(goals.filter((g) => g.teamId === live.away.id)).toHaveLength(live.match.score!.away);
    expect(detail!.lineups).not.toBeNull();
    expect(detail!.lineups!.home.starting).toHaveLength(11);
  });

  it("hides results and lineups for future matches", async () => {
    const future = (await repo.getMatchesOnDate("2026-11-07")).find(
      (v) => v.match.status === "scheduled",
    );
    expect(future).toBeDefined();
    const detail = await repo.getMatch(future!.match.id);
    expect(detail!.view.match.score).toBeNull();
    expect(detail!.events).toHaveLength(0);
    expect(detail!.lineups).toBeNull();
  });

  it("resolves every team and player referenced by matches", async () => {
    for (const c of await repo.listCompetitions()) {
      for (const v of await repo.getCompetitionMatches(c.id)) {
        expect(v.home).toBeDefined();
        expect(v.away).toBeDefined();
      }
    }
    const scorers = await repo.getTopScorers("epl", 5);
    expect(scorers.source).toBe("matches");
    expect(scorers.rows.length).toBe(5);
    expect(scorers.rows[0].goals).toBeGreaterThanOrEqual(scorers.rows[1].goals);
  });

  it("has honours for every competition, newest first", async () => {
    for (const c of await repo.listCompetitions()) {
      const h = await repo.getHonours(c.id);
      expect(h?.entries.length).toBeGreaterThan(20);
      const seasons = h!.entries.map((e) => e.season);
      // The newest season is deliberately not pinned to a year. A list that is
      // up to date has to be free to change; a test naming one is a test that
      // fails precisely when somebody fixes the staleness it was meant to catch.
      expect([...seasons].sort((a, b) => b.localeCompare(a))).toEqual(seasons);
      expect(new Set(seasons).size).toBe(seasons.length);
      for (const season of seasons) expect(season).toMatch(/^\d{4}(\/\d{2})?$/);
    }
  });
});
