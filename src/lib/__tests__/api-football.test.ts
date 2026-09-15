import { describe, expect, it } from "vitest";
import { ApiFootballProvider } from "../pipeline/providers/api-football";
import type { Competition } from "../types";

const epl: Competition = {
  id: "epl",
  slug: "premier-league",
  name: "Premier League",
  shortName: "PL",
  country: "England",
  countryCode: "GB-ENG",
  kind: "league",
  order: 1,
  season: "2026/27",
  teamCount: 20,
  rounds: 38,
  zones: [],
  color: "#000",
};
const uel: Competition = {
  ...epl,
  id: "uel",
  slug: "europa-league",
  name: "UEFA Europa League",
  shortName: "UEL",
  kind: "cup",
};

const fixture = {
  fixture: {
    id: 1001,
    date: "2026-09-19T14:00:00+00:00",
    status: { short: "2H", elapsed: 67, extra: null },
    venue: { name: "Emirates Stadium" },
    referee: "M. Oliver",
  },
  league: { id: 39, round: "Regular Season - 5", season: 2026 },
  teams: { home: { id: 42, name: "Arsenal" }, away: { id: 49, name: "Chelsea" } },
  goals: { home: 2, away: 1 },
  score: { halftime: { home: 1, away: 0 } },
};
const details = {
  ...fixture,
  events: [
    {
      time: { elapsed: 12, extra: null },
      team: { id: 42, name: "Arsenal" },
      player: { id: 1, name: "B. Saka" },
      assist: { id: 2, name: "M. Odegaard" },
      type: "Goal",
      detail: "Normal Goal",
    },
    {
      time: { elapsed: 45, extra: 2 },
      team: { id: 49, name: "Chelsea" },
      player: { id: 3, name: "C. Palmer" },
      assist: { id: null, name: null },
      type: "Goal",
      detail: "Penalty",
    },
    {
      time: { elapsed: 60, extra: null },
      team: { id: 49, name: "Chelsea" },
      player: { id: 4, name: "W. Fofana" },
      assist: { id: null, name: null },
      type: "Goal",
      detail: "Own Goal",
    },
    {
      time: { elapsed: 63, extra: null },
      team: { id: 42, name: "Arsenal" },
      player: { id: 5, name: "G. Jesus" },
      assist: { id: 1, name: "B. Saka" },
      type: "subst",
      detail: "Substitution 1",
    },
    {
      time: { elapsed: 66, extra: null },
      team: { id: 49, name: "Chelsea" },
      player: { id: 3, name: "C. Palmer" },
      assist: { id: null, name: null },
      type: "Card",
      detail: "Yellow Card",
    },
  ],
  lineups: [
    {
      team: { id: 49, name: "Chelsea" },
      formation: "4-2-3-1",
      startXI: [{ player: { id: 30, name: "R. Sanchez", number: 1, pos: "G", grid: "1:1" } }],
      substitutes: [{ player: { id: 31, name: "F. Jorgensen", number: 12, pos: "G", grid: null } }],
      coach: { name: "Enzo Maresca" },
    },
    {
      team: { id: 42, name: "Arsenal" },
      formation: "4-3-3",
      startXI: [{ player: { id: 20, name: "D. Raya", number: 22, pos: "G", grid: "1:1" } }],
      substitutes: [],
      coach: { name: "Mikel Arteta" },
    },
  ],
};

function fakeFetch(calls: string[], remaining = "80"): typeof fetch {
  return (async (url: string | URL | Request) => {
    const u = String(url);
    calls.push(u);
    const body = u.includes("/fixtures?ids=")
      ? [details]
      : u.includes("/fixtures?date=2026-09-19")
        ? [fixture]
        : u.includes("/fixtures?league=3&")
          ? [
              {
                ...fixture,
                fixture: {
                  ...fixture.fixture,
                  id: 2002,
                  date: "2026-10-02T19:00:00+00:00",
                  status: { short: "NS", elapsed: null },
                },
                league: { id: 3, round: "League Stage - 2", season: 2026 },
              },
            ]
          : [];
    return new Response(JSON.stringify({ response: body, errors: [] }), {
      status: 200,
      headers: { "content-type": "application/json", "x-ratelimit-requests-remaining": remaining },
    });
  }) as typeof fetch;
}

const known = [
  { id: "arsenal", name: "Arsenal", shortName: "Arsenal" },
  { id: "chelsea", name: "Chelsea", shortName: "Chelsea" },
];
const resolved: string[] = [];
const resolvePlayer = async (teamId: string, p: { externalId: string; name: string }) => {
  resolved.push(`${teamId}/${p.name}`);
  return `${teamId}:${p.externalId}`;
};

describe("ApiFootballProvider", () => {
  it("fetches the day once, details in one batch, and maps events and line-ups", async () => {
    const calls: string[] = [];
    const p = new ApiFootballProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...known],
      resolvePlayer,
      detailsEnabled: true,
      primaryFor: ["uel"],
      fetchImpl: fakeFetch(calls),
      now: () => new Date("2026-09-19T15:10:00Z"),
    });
    const out = await p.fetchMatches(epl, { fromDate: "2026-07-01", toDate: "2027-06-30" });
    expect(calls.filter((c) => c.includes("/fixtures?date=")).length).toBe(3); // yesterday, today, tomorrow
    expect(calls.filter((c) => c.includes("/fixtures?ids=1001"))).toHaveLength(1);
    expect(out).toHaveLength(1);
    const m = out[0].value;
    expect(m).toMatchObject({
      homeTeamId: "arsenal",
      awayTeamId: "chelsea",
      status: "live",
      phase: "2H",
      minute: 67,
      round: 5,
      score: { home: 2, away: 1 },
      halfTimeScore: { home: 1, away: 0 },
    });
    expect(m.events?.map((e) => e.type)).toEqual([
      "goal",
      "penalty",
      "own_goal",
      "substitution",
      "yellow",
    ]);
    const own = m.events![2];
    expect(own.teamId).toBe("chelsea");
    expect(own.playerId).toBe("arsenal:4"); // credited to the other side's player
    const sub = m.events![3];
    expect(sub.playerId).toBe("arsenal:1"); // Saka off
    expect(sub.relatedPlayerId).toBe("arsenal:5"); // Jesus on
    expect(m.events![1]).toMatchObject({ minute: 45, addedTime: 2 });
    expect(m.lineups?.home.formation).toBe("4-3-3");
    expect(m.lineups?.home.starting[0]).toMatchObject({
      playerId: "arsenal:20",
      shirtNumber: 22,
      position: "GK",
      grid: "1:1",
    });
    expect(m.lineups?.away.bench[0].playerId).toBe("chelsea:31");
    expect(m.lineups?.away.coach).toBe("Enzo Maresca");
    expect(p.remaining).toBe(80);
  });

  it("serves the whole season for competitions it is primary for", async () => {
    const calls: string[] = [];
    const p = new ApiFootballProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...known],
      resolvePlayer,
      detailsEnabled: false,
      primaryFor: ["uel"],
      fetchImpl: fakeFetch(calls),
      now: () => new Date("2026-09-19T15:10:00Z"),
    });
    const out = await p.fetchMatches(uel, { fromDate: "2026-07-01", toDate: "2027-06-30" });
    expect(calls).toEqual([
      "https://v3.football.api-sports.io/fixtures?league=3&season=2026&timezone=UTC",
    ]);
    expect(out[0].value).toMatchObject({ status: "scheduled", stage: "League Stage", round: 2 });
  });

  it("stops spending when the daily budget is near the reserve", async () => {
    const calls: string[] = [];
    const p = new ApiFootballProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...known],
      resolvePlayer,
      detailsEnabled: true,
      fetchImpl: fakeFetch(calls, "4"),
      now: () => new Date("2026-09-19T15:10:00Z"),
    });
    await p.fetchMatches(epl, { fromDate: "2026-07-01", toDate: "2027-06-30" });
    // first request reveals 4 left -> everything else is skipped
    expect(calls).toHaveLength(1);
  });

  it("disables itself for the run on a plan error", async () => {
    const f = (async () =>
      new Response(
        JSON.stringify({
          response: [],
          errors: { plan: "Free plans do not have access to this season" },
        }),
        { status: 200 },
      )) as typeof fetch;
    const p = new ApiFootballProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...known],
      resolvePlayer,
      detailsEnabled: true,
      primaryFor: ["uel"],
      fetchImpl: f,
    });
    await expect(
      p.fetchMatches(uel, { fromDate: "2026-07-01", toDate: "2027-06-30" }),
    ).rejects.toThrow(/plan/);
    expect(await p.fetchMatches(epl, { fromDate: "2026-07-01", toDate: "2027-06-30" })).toEqual([]);
  });
});
