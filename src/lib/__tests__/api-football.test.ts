import { describe, expect, it } from "vitest";
import { ApiFootballProvider } from "../pipeline/providers/api-football";
import type { Competition } from "../types";
import type { CatchUpWindow, DetailStore, MatchNeedingDetail } from "../pipeline/types";

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
const KEY = "epl:2026-09-19:arsenal:chelsea";

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
const events = [
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
    player: { id: 1, name: "B. Saka" },
    assist: { id: 5, name: "G. Jesus" },
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
];
const lineups = [
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
];

function fakeFetch(calls: string[], remaining = "80"): typeof fetch {
  return (async (url: string | URL | Request) => {
    const u = String(url);
    calls.push(u);
    let body: unknown = [];
    if (u.includes("/fixtures?live=all")) body = [{ ...fixture, events }];
    else if (u.includes("/fixtures?date=2026-09-19")) body = [fixture];
    else if (u.includes("/fixtures/lineups?fixture=1001")) body = lineups;
    else if (u.includes("/fixtures/events?fixture=1001")) body = events;
    else if (u.includes("/fixtures?league=3&"))
      body = [
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
      ];
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
const resolvePlayer = async (teamId: string, p: { externalId: string }) =>
  `${teamId}:${p.externalId}`;

function store(
  needing: Partial<MatchNeedingDetail>[],
  starters: string[] = [],
): DetailStore & { saved: string[]; catchUpAsked: CatchUpWindow | undefined } {
  const saved: string[] = [];
  return {
    saved,
    catchUpAsked: undefined,
    async matchesNeedingDetail(_provider, _now, _before, _after, catchUp) {
      this.catchUpAsked = catchUp;
      return needing
        .filter((m) => catchUp || !m.catchUp)
        .map((m) => ({
          id: KEY,
          competitionId: "epl",
          kickoff: "2026-09-19T14:00:00.000Z",
          homeTeamId: "arsenal",
          awayTeamId: "chelsea",
          status: "live" as const,
          hasLineups: false,
          hasEvents: false,
          hasFinalEvents: false,
          externalId: null,
          ...m,
        }));
    },
    async saveMatchAlias(_p, matchId, externalId) {
      saved.push(`${matchId}=${externalId}`);
    },
    async startingPlayerIds() {
      return new Set(starters);
    },
  };
}
const window = { fromDate: "2026-07-01", toDate: "2027-06-30" };
const now = () => new Date("2026-09-19T15:10:00Z");

describe("ApiFootballProvider", () => {
  it("gets a live match's minute, score and events from the shared live call and its line-ups once", async () => {
    const calls: string[] = [];
    const st = store([{}]);
    const p = new ApiFootballProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...known],
      resolvePlayer,
      detailStore: st,
      detailsEnabled: true,
      primaryFor: ["uel"],
      fetchImpl: fakeFetch(calls),
      now,
    });
    const out = await p.fetchMatches(epl, window);
    expect(calls.map((c) => c.replace("https://v3.football.api-sports.io", ""))).toEqual([
      "/fixtures?date=2026-09-19&timezone=UTC",
      "/fixtures/lineups?fixture=1001",
      "/fixtures?live=all&timezone=UTC",
    ]);
    expect(st.saved).toEqual([`${KEY}=1001`]);
    expect(out).toHaveLength(1);
    const m = out[0].value;
    expect(m.partial).toBeUndefined();
    expect(m).toMatchObject({
      status: "live",
      phase: "2H",
      minute: 67,
      score: { home: 2, away: 1 },
    });
    expect(m.events?.map((e) => e.type)).toEqual([
      "goal",
      "penalty",
      "own_goal",
      "substitution",
      "yellow",
    ]);
    expect(m.events![2].playerId).toBe("arsenal:4"); // own goal credited to the other side
    expect(m.events![3]).toMatchObject({ playerId: "arsenal:1", relatedPlayerId: "arsenal:5" }); // Saka off, Jesus on
    expect(m.lineups?.home.formation).toBe("4-3-3");
    expect(m.lineups?.away.coach).toBe("Enzo Maresca");
  });

  it("fetches final events once for a finished match with a remembered id, as a partial record", async () => {
    const calls: string[] = [];
    const p = new ApiFootballProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...known],
      resolvePlayer,
      detailStore: store([
        { status: "finished", hasLineups: true, hasEvents: true, externalId: "1001" },
      ]),
      detailsEnabled: true,
      fetchImpl: fakeFetch(calls),
      now: () => new Date("2026-09-19T17:00:00Z"),
    });
    const out = await p.fetchMatches(epl, window);
    expect(calls.map((c) => c.split("io")[1])).toEqual(["/fixtures/events?fixture=1001"]);
    expect(out[0].value.partial).toBe(true);
    expect(out[0].value.events).toHaveLength(5);
    // Events the live feed already left behind are no reason to skip the full
    // list: that is exactly how a timeline ends up stopping at the 60th minute.
    expect(out[0].value.eventsFinal).toBe(true);
  });

  it("reads the direction of a substitution from the starting XI, not from the field order", async () => {
    // The provider says Saka went off and Jesus came on. Here Jesus is the one
    // who started, so the arrows have to point the other way.
    const p = new ApiFootballProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...known],
      resolvePlayer,
      detailStore: store(
        [{ status: "finished", hasLineups: true, hasEvents: true, externalId: "1001" }],
        ["arsenal:5"],
      ),
      detailsEnabled: true,
      fetchImpl: fakeFetch([]),
      now: () => new Date("2026-09-19T17:00:00Z"),
    });
    const out = await p.fetchMatches(epl, window);
    const sub = out[0].value.events!.find((e) => e.type === "substitution");
    expect(sub).toMatchObject({ playerId: "arsenal:5", relatedPlayerId: "arsenal:1" });
  });

  it("fills in an old match whose timeline never completed", async () => {
    const calls: string[] = [];
    const st = store([
      { catchUp: true, status: "finished", hasLineups: true, hasEvents: true, externalId: "1001" },
    ]);
    const p = new ApiFootballProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...known],
      resolvePlayer,
      detailStore: st,
      detailsEnabled: true,
      catchUp: { days: 45, limit: 2 },
      fetchImpl: fakeFetch(calls),
      now: () => new Date("2026-09-25T12:00:00Z"),
    });
    const out = await p.fetchMatches(epl, window);
    expect(st.catchUpAsked).toEqual({ days: 45, limit: 2 });
    expect(calls.map((c) => c.split("io")[1])).toEqual(["/fixtures/events?fixture=1001"]);
    expect(out[0].value.events).toHaveLength(5);
    expect(out[0].value.eventsFinal).toBe(true);
  });

  it("stops catching up once the day's quota runs low, and never asks without one", async () => {
    const calls: string[] = [];
    const rows: Partial<MatchNeedingDetail>[] = [
      { catchUp: true, status: "finished", hasLineups: true, externalId: "1001" },
      {
        id: "epl:2026-09-12:arsenal:chelsea",
        catchUp: true,
        status: "finished",
        hasLineups: true,
        externalId: "1002",
      },
    ];
    const opts = {
      apiKey: "k",
      season: 2026,
      knownTeams: [...known],
      resolvePlayer,
      detailsEnabled: true,
      now: () => new Date("2026-09-25T12:00:00Z"),
    };
    // 30 requests left is below the reserve kept for matches in play, so the
    // second match waits for tomorrow.
    const lean = store(rows);
    const p = new ApiFootballProvider({
      ...opts,
      detailStore: lean,
      catchUp: { days: 45, limit: 2 },
      fetchImpl: fakeFetch(calls, "30"),
    });
    await p.fetchMatches(epl, window);
    expect(calls.map((c) => c.split("io")[1])).toEqual(["/fixtures/events?fixture=1001"]);

    // And with catching up switched off, the store is not even asked for them.
    const off = store(rows);
    const q = new ApiFootballProvider({ ...opts, detailStore: off, fetchImpl: fakeFetch([]) });
    expect(await q.fetchMatches(epl, window)).toEqual([]);
    expect(off.catchUpAsked).toBeUndefined();
  });

  it("does nothing for a match that already has everything", async () => {
    const calls: string[] = [];
    const p = new ApiFootballProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...known],
      resolvePlayer,
      detailStore: store([
        {
          status: "finished",
          hasLineups: true,
          hasEvents: true,
          hasFinalEvents: true,
          externalId: "1001",
        },
      ]),
      detailsEnabled: true,
      fetchImpl: fakeFetch(calls),
      now: () => new Date("2026-09-19T17:00:00Z"),
    });
    expect(await p.fetchMatches(epl, window)).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("serves the whole season for competitions it is primary for", async () => {
    const calls: string[] = [];
    const p = new ApiFootballProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...known],
      resolvePlayer,
      detailStore: store([]),
      detailsEnabled: false,
      primaryFor: ["uel"],
      fetchImpl: fakeFetch(calls),
      now,
    });
    const out = await p.fetchMatches(uel, window);
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
      detailStore: store([{}]),
      detailsEnabled: true,
      fetchImpl: fakeFetch(calls, "4"),
      now,
    });
    await p.fetchMatches(epl, window);
    expect(calls).toHaveLength(1);
  });

  it("keeps going after a per-endpoint plan error but stops on a token error", async () => {
    const calls: string[] = [];
    const f = (async (url: string | URL | Request) => {
      const u = String(url);
      calls.push(u);
      const errors = u.includes("lineups")
        ? { plan: "Free plans do not have access to this endpoint." }
        : u.includes("league=3")
          ? { token: "Error/Missing application key." }
          : [];
      const body = u.includes("live=all")
        ? [{ ...fixture, events }]
        : u.includes("date=")
          ? [fixture]
          : [];
      return new Response(JSON.stringify({ response: body, errors }), { status: 200 });
    }) as typeof fetch;
    const p = new ApiFootballProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...known],
      resolvePlayer,
      detailStore: store([{}]),
      detailsEnabled: true,
      primaryFor: ["uel"],
      fetchImpl: f,
      now,
    });
    const out = await p.fetchMatches(epl, window);
    expect(out).toHaveLength(1); // live data survived the line-ups failure
    await expect(p.fetchMatches(uel, window)).rejects.toThrow(/token/);
    expect(await p.fetchMatches(epl, window)).toEqual([]); // disabled after the token error
  });
});

describe("live refresh shape", () => {
  it("does not spend requests on whole-season lists unless seeding", async () => {
    const calls: string[] = [];
    const p = new ApiFootballProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...known],
      resolvePlayer,
      detailStore: store([]),
      detailsEnabled: false,
      primaryFor: ["uel"],
      seasonFetchEnabled: false,
      fetchImpl: fakeFetch(calls),
      now,
    });
    expect(await p.fetchMatches(uel, window)).toEqual([]);
    expect(calls).toEqual([]);
  });
});
