import { describe, expect, it } from "vitest";
import { runSync } from "../pipeline/sync";
import { DryRunStore } from "../pipeline/store";
import type { Competition } from "../types";
import type { Provider, ProviderMatch, ProviderRecord, ProviderTeam } from "../pipeline/types";

const comp = (id: string, kind: "league" | "cup" = "league"): Competition => ({
  id,
  slug: id,
  name: id,
  shortName: id.toUpperCase(),
  country: "x",
  countryCode: "x",
  kind,
  order: 1,
  season: "2026/27",
  teamCount: 2,
  rounds: 2,
  zones: [],
  color: "#000",
});

function match(competitionId: string, home: string, away: string): ProviderRecord<ProviderMatch> {
  return {
    provider: "fake",
    externalId: "1",
    value: {
      id: "",
      competitionId,
      round: 1,
      kickoff: "2026-09-19T14:00:00.000Z",
      homeTeamId: home,
      awayTeamId: away,
      status: "finished",
      phase: "FT",
      minute: null,
      score: { home: 1, away: 0 },
      halfTimeScore: null,
    },
  };
}
const team = (id: string, squad = 0): ProviderRecord<ProviderTeam> => ({
  provider: "fake",
  externalId: `x-${id}`,
  value: {
    id,
    name: id,
    shortName: id,
    code: id.slice(0, 3),
    country: "x",
    countryCode: "x",
    city: "",
    stadium: "",
    founded: 1900,
    squad: Array.from({ length: squad }, (_, i) => ({
      externalId: `${id}-${i}`,
      name: `P ${i}`,
      firstName: "P",
      lastName: String(i),
      position: "MF" as const,
      shirtNumber: i,
      nationality: "x",
      nationalityCode: "X",
      dateOfBirth: "2000-01-01",
    })),
  },
});

function fakeProvider(): Provider & { squadCalls: string[] } {
  const p = {
    id: "fake",
    weight: 0.8,
    squadCalls: [] as string[],
    supports: () => true,
    async fetchTeams(c: Competition) {
      if (c.id === "uel") throw new Error("fake 403 for /competitions/EL/teams: not in plan");
      if (c.id === "ucl") return [team("a"), team("z")]; // cup lists carry no squads
      return [team("a", 3), team("b", 3)];
    },
    async fetchMatches(c: Competition) {
      if (c.id === "uel") throw new Error("fake 403 for /competitions/EL/matches");
      return c.id === "ucl" ? [match("ucl", "a", "z")] : [match(c.id, "a", "b")];
    },
    async fetchSquad(externalId: string) {
      p.squadCalls.push(externalId);
      return [{ provider: "fake", externalId: "q", value: team(externalId, 1).value.squad![0] }];
    },
  };
  return p;
}

describe("runSync", () => {
  it("skips a competition the provider refuses and still writes the others", async () => {
    const lines: string[] = [];
    const provider = fakeProvider();
    const result = await runSync({
      competitions: [comp("epl"), comp("uel", "cup"), comp("ucl", "cup")],
      providers: [provider],
      window: { fromDate: "2026-07-01", toDate: "2027-06-30" },
      store: new DryRunStore(() => {}),
      seed: true,
      log: (l) => lines.push(l),
    });
    expect(result.written).toBe(2);
    expect(result.skipped).toEqual(["uel/fake"]);
    expect(lines.some((l) => l.includes("UEL") && l.includes("skipped"))).toBe(true);
    // squads: fetched only for the cup-only club, not for the league club seeded earlier
    expect(provider.squadCalls).toEqual(["x-z"]);
    expect(result.seeded.players).toBe(7);
  });
});

describe("runSync in live mode", () => {
  it("uses one combined request per provider instead of asking competition by competition", async () => {
    const perCompetition: string[] = [];
    const provider = fakeProvider();
    const combined: Provider & { acrossCalls: number } = {
      ...provider,
      acrossCalls: 0,
      async fetchAcross(competitions) {
        this.acrossCalls++;
        return competitions.map((c) => match(c.id, "a", "b"));
      },
      async fetchMatches(c: Competition) {
        perCompetition.push(c.id);
        return [];
      },
    };
    const result = await runSync({
      competitions: [comp("epl"), comp("laliga")],
      providers: [combined],
      window: { fromDate: "2026-09-19", toDate: "2026-09-20" },
      store: new DryRunStore(() => {}),
      mode: "live",
      log: () => {},
    });
    expect(combined.acrossCalls).toBe(1);
    expect(perCompetition).toEqual([]);
    expect(result.written).toBe(2);
  });

  it("falls back to per-competition requests when the combined one throws", async () => {
    const provider = fakeProvider();
    const broken: Provider = {
      ...provider,
      async fetchAcross() {
        throw new Error("not on this plan");
      },
    };
    const result = await runSync({
      competitions: [comp("epl")],
      providers: [broken],
      window: { fromDate: "2026-09-19", toDate: "2026-09-20" },
      store: new DryRunStore(() => {}),
      mode: "live",
      log: () => {},
    });
    expect(result.written).toBe(1);
  });
});

describe("runSync scorer charts", () => {
  const chart = [
    { playerId: "p1", teamId: "a", goals: 7, assists: 2, penalties: 1, appearances: 6 },
  ];

  it("asks only for the competitions it was given, and stores what comes back", async () => {
    const asked: string[] = [];
    const written: { competition: string; provider: string; rows: number }[] = [];
    const provider: Provider = {
      ...fakeProvider(),
      async fetchScorers(c: Competition) {
        asked.push(c.id);
        return chart;
      },
    };
    const store = new DryRunStore(() => {});
    store.upsertScorers = async (c, p, rows) => {
      written.push({ competition: c.id, provider: p, rows: rows.length });
      return rows.length;
    };
    const result = await runSync({
      competitions: [comp("epl"), comp("laliga")],
      providers: [provider],
      window: { fromDate: "2026-07-01", toDate: "2027-06-30" },
      store,
      scorersFor: [comp("laliga")],
    });
    expect(asked).toEqual(["laliga"]);
    expect(written).toEqual([{ competition: "laliga", provider: "fake", rows: 1 }]);
    expect(result.scorers).toEqual({ laliga: 1 });
  });

  it("keeps the chart it has when the provider fails, and finishes the run", async () => {
    const lines: string[] = [];
    const provider: Provider = {
      ...fakeProvider(),
      async fetchScorers() {
        throw new Error("503 from the provider");
      },
    };
    const store = new DryRunStore(() => {});
    let wrote = false;
    store.upsertScorers = async (_c, _p, rows) => {
      wrote = true;
      return rows.length;
    };
    const result = await runSync({
      competitions: [comp("epl")],
      providers: [provider],
      window: { fromDate: "2026-07-01", toDate: "2027-06-30" },
      store,
      scorersFor: [comp("epl")],
      log: (l) => lines.push(l),
    });
    expect(wrote).toBe(false);
    expect(result.scorers).toEqual({});
    expect(result.written).toBe(1);
    expect(lines.some((l) => l.includes("scorer chart failed"))).toBe(true);
  });

  it("leaves the stored chart alone when the provider returns an empty one", async () => {
    const provider: Provider = {
      ...fakeProvider(),
      async fetchScorers() {
        return [];
      },
    };
    const store = new DryRunStore(() => {});
    let wrote = false;
    store.upsertScorers = async (_c, _p, rows) => {
      wrote = true;
      return rows.length;
    };
    await runSync({
      competitions: [comp("epl")],
      providers: [provider],
      window: { fromDate: "2026-07-01", toDate: "2027-06-30" },
      store,
      scorersFor: [comp("epl")],
    });
    expect(wrote).toBe(false);
  });
});
