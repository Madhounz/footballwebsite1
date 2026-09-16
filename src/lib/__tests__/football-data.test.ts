import { describe, expect, it } from "vitest";
import { FootballDataProvider, mapPosition } from "../pipeline/providers/football-data";
import type { Competition } from "../types";

const comp: Competition = {
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

function fake(routes: Record<string, unknown>): typeof fetch {
  return (async (url: string | URL | Request) => {
    const u = String(url);
    const key = Object.keys(routes).find((k) => u.includes(k));
    if (!key) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(routes[key]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

const known = [
  { id: "arsenal", name: "Arsenal", shortName: "Arsenal" },
  { id: "chelsea", name: "Chelsea", shortName: "Chelsea" },
];

describe("FootballDataProvider scorers", () => {
  const chart = {
    scorers: [
      {
        player: { id: 44, name: "Bukayo Saka", position: "Offence" },
        team: { id: 57, name: "Arsenal FC", shortName: "Arsenal" },
        playedMatches: 6,
        goals: 7,
        assists: 3,
        penalties: 1,
      },
      {
        player: { id: 91, name: "Cole Palmer", position: "Midfield" },
        team: { id: 61, name: "Chelsea FC", shortName: "Chelsea" },
        playedMatches: 6,
        goals: 5,
        assists: null,
        penalties: null,
      },
      {
        player: { id: 12, name: "Someone Else", position: null },
        team: { id: 99, name: "Elsewhere United", shortName: null },
        playedMatches: 4,
        goals: 4,
        assists: 1,
        penalties: 0,
      },
    ],
  };

  it("reads the chart the competition publishes, resolving players and teams", async () => {
    const p = new FootballDataProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...known],
      noThrottle: true,
      resolvePlayer: async (teamId, ref) => `${teamId}:${ref.externalId}`,
      fetchImpl: fake({ "/competitions/PL/scorers": chart }),
    });
    const rows = await p.fetchScorers(comp);
    // A club we do not have is left out rather than guessed at.
    expect(rows).toEqual([
      {
        playerId: "arsenal:44",
        teamId: "arsenal",
        goals: 7,
        assists: 3,
        penalties: 1,
        appearances: 6,
      },
      {
        playerId: "chelsea:91",
        teamId: "chelsea",
        goals: 5,
        assists: 0,
        penalties: 0,
        appearances: 6,
      },
    ]);
  });

  it("asks for a chart deep enough to hold the players who create goals", async () => {
    const calls: string[] = [];
    const p = new FootballDataProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...known],
      noThrottle: true,
      resolvePlayer: async (teamId, ref) => `${teamId}:${ref.externalId}`,
      fetchImpl: (async (url: string) => {
        calls.push(String(url));
        return new Response(JSON.stringify(chart), { status: 200 });
      }) as unknown as typeof fetch,
    });
    await p.fetchScorers(comp);
    // Thirty rows is the top scorers' assists, not the competition's.
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("limit=100");
  });

  it("asks for a narrower chart rather than leaving the old one standing", async () => {
    const calls: string[] = [];
    const lines: string[] = [];
    const p = new FootballDataProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...known],
      noThrottle: true,
      resolvePlayer: async (teamId, ref) => `${teamId}:${ref.externalId}`,
      log: (line) => lines.push(line),
      fetchImpl: (async (url: string) => {
        calls.push(String(url));
        if (String(url).includes("limit=100")) return new Response("no", { status: 400 });
        return new Response(JSON.stringify(chart), { status: 200 });
      }) as unknown as typeof fetch,
    });
    const rows = await p.fetchScorers(comp);
    expect(calls.map((u) => u.split("limit=")[1])).toEqual(["100", "30"]);
    expect(rows).toHaveLength(2);
    expect(lines.join(" ")).toContain("asking for 30");
  });

  it("does not spend a second request on a rate limit", async () => {
    const calls: string[] = [];
    const p = new FootballDataProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...known],
      noThrottle: true,
      resolvePlayer: async (teamId, ref) => `${teamId}:${ref.externalId}`,
      fetchImpl: (async (url: string) => {
        calls.push(String(url));
        return new Response("slow down", { status: 429 });
      }) as unknown as typeof fetch,
    });
    await expect(p.fetchScorers(comp)).rejects.toThrow(/rate limited/);
    expect(calls).toHaveLength(1);
  });

  it("fetches nothing without a way to resolve players", async () => {
    const calls: string[] = [];
    const p = new FootballDataProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...known],
      noThrottle: true,
      fetchImpl: (async (url: string) => {
        calls.push(String(url));
        return new Response("{}", { status: 200 });
      }) as unknown as typeof fetch,
    });
    expect(await p.fetchScorers(comp)).toEqual([]);
    expect(calls).toEqual([]);
  });
});

describe("FootballDataProvider", () => {
  it("maps a season's matches into our model and filters by window", async () => {
    const calls: string[] = [];
    const p = new FootballDataProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...known],
      noThrottle: true,
      fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
        calls.push(String(url));
        expect((init?.headers as Record<string, string>)["X-Auth-Token"]).toBe("k");
        return fake({
          "/competitions/PL/matches?season=2026": {
            matches: [
              {
                id: 1,
                utcDate: "2026-09-19T14:00:00Z",
                status: "FINISHED",
                matchday: 5,
                stage: "REGULAR_SEASON",
                lastUpdated: "2026-09-19T16:00:00Z",
                homeTeam: { id: 57, name: "Arsenal FC", shortName: "Arsenal", tla: "ARS" },
                awayTeam: { id: 61, name: "Chelsea FC", shortName: "Chelsea", tla: "CHE" },
                score: {
                  duration: "REGULAR",
                  fullTime: { home: 2, away: 1 },
                  halfTime: { home: 1, away: 0 },
                },
              },
              {
                id: 2,
                utcDate: "2026-12-01T20:00:00Z",
                status: "TIMED",
                matchday: 14,
                stage: "REGULAR_SEASON",
                lastUpdated: "2026-09-01T00:00:00Z",
                homeTeam: { id: 61, name: "Chelsea FC", shortName: "Chelsea", tla: "CHE" },
                awayTeam: { id: 57, name: "Arsenal FC", shortName: "Arsenal", tla: "ARS" },
                score: {
                  duration: "REGULAR",
                  fullTime: { home: null, away: null },
                  halfTime: { home: null, away: null },
                },
              },
              {
                id: 3,
                utcDate: "2026-09-20T14:00:00Z",
                status: "IN_PLAY",
                matchday: 5,
                stage: "REGULAR_SEASON",
                lastUpdated: "2026-09-20T14:30:00Z",
                homeTeam: { id: 999, name: "Unknown Town FC", shortName: "Unknown", tla: "UNK" },
                awayTeam: { id: 57, name: "Arsenal FC", shortName: "Arsenal", tla: "ARS" },
                score: {
                  duration: "REGULAR",
                  fullTime: { home: 0, away: 0 },
                  halfTime: { home: null, away: null },
                },
              },
            ],
          },
        })(url, init);
      }) as typeof fetch,
    });
    const all = await p.fetchMatches(comp, { fromDate: "2026-07-01", toDate: "2027-06-30" });
    expect(calls).toHaveLength(1);
    expect(all).toHaveLength(2); // the unknown team's match is skipped, not invented
    expect(all[0].value).toMatchObject({
      homeTeamId: "arsenal",
      awayTeamId: "chelsea",
      status: "finished",
      phase: "FT",
      round: 5,
      score: { home: 2, away: 1 },
      halfTimeScore: { home: 1, away: 0 },
    });
    expect(all[1].value).toMatchObject({ status: "scheduled", score: null });
    const sept = await p.fetchMatches(comp, { fromDate: "2026-09-01", toDate: "2026-09-30" });
    expect(sept).toHaveLength(1);
  });

  it("seeds teams and squads, minting ids for clubs it has never seen", async () => {
    const knownTeams = [...known];
    const p = new FootballDataProvider({
      apiKey: "k",
      season: 2026,
      knownTeams,
      noThrottle: true,
      fetchImpl: fake({
        "/competitions/PL/teams?season=2026": {
          teams: [
            {
              id: 57,
              name: "Arsenal FC",
              shortName: "Arsenal",
              tla: "ARS",
              address: "Highbury House 75 Drayton Park London N5 1BU",
              founded: 1886,
              clubColors: "Red / White",
              venue: "Emirates Stadium",
              area: { name: "England", code: "ENG" },
              coach: { name: "Mikel Arteta" },
              squad: [
                {
                  id: 1,
                  name: "David Raya",
                  position: "Goalkeeper",
                  dateOfBirth: "1995-09-15",
                  nationality: "Spain",
                  shirtNumber: 22,
                },
                {
                  id: 2,
                  name: "Bukayo Saka",
                  position: "Right Winger",
                  dateOfBirth: "2001-09-05",
                  nationality: "England",
                  shirtNumber: 7,
                },
              ],
            },
            {
              id: 1044,
              name: "Wrexham AFC",
              shortName: "Wrexham",
              tla: "WRE",
              address: "Mold Road Wrexham LL11 2AH",
              founded: 1864,
              clubColors: "Red / White",
              venue: "Racecourse Ground",
              area: { name: "England", code: "ENG" },
              squad: [],
            },
          ],
        },
      }),
    });
    const teams = (await p.fetchTeams(comp)).map((r) => r.value);
    expect(teams[0]).toMatchObject({
      id: "arsenal",
      isNew: false,
      code: "ARS",
      city: "London",
      countryCode: "GB-ENG",
      colors: ["#d62828", "#ffffff"],
      manager: "Mikel Arteta",
    });
    expect(teams[0].squad).toHaveLength(2);
    expect(teams[0].squad?.[0]).toMatchObject({
      position: "GK",
      shirtNumber: 22,
      nationalityCode: "ES",
      lastName: "Raya",
    });
    expect(teams[0].squad?.[1]).toMatchObject({ position: "FW", nationalityCode: "GB-ENG" });
    expect(teams[1]).toMatchObject({ id: "wrexham", isNew: true, city: "Wrexham" });
    // the new club is now resolvable for match ingestion in the same run
    expect(knownTeams.some((t) => t.id === "wrexham")).toBe(true);
  });

  it("maps provider positions to our four", () => {
    expect(mapPosition("Goalkeeper")).toBe("GK");
    expect(mapPosition("Centre-Back")).toBe("DF");
    expect(mapPosition("Defensive Midfield")).toBe("MF");
    expect(mapPosition("Centre-Forward")).toBe("FW");
    expect(mapPosition("Left Winger")).toBe("FW");
    expect(mapPosition(null)).toBe("MF");
  });
});

describe("FootballDataProvider.fetchAcross", () => {
  const laliga: Competition = { ...comp, id: "laliga", shortName: "LL", name: "La Liga" };
  const across = {
    matches: [
      {
        id: 7,
        competition: { id: 2021, code: "PL", name: "Premier League" },
        utcDate: "2026-09-19T14:00:00Z",
        status: "FINISHED",
        matchday: 5,
        stage: "REGULAR_SEASON",
        lastUpdated: "2026-09-19T16:00:00Z",
        homeTeam: { id: 57, name: "Arsenal FC", shortName: "Arsenal", tla: "ARS" },
        awayTeam: { id: 61, name: "Chelsea FC", shortName: "Chelsea", tla: "CHE" },
        score: {
          duration: "REGULAR",
          fullTime: { home: 3, away: 0 },
          halfTime: { home: 2, away: 0 },
        },
      },
      {
        id: 8,
        competition: { id: 2014, code: "PD", name: "La Liga" },
        utcDate: "2026-09-19T19:00:00Z",
        status: "IN_PLAY",
        matchday: 5,
        stage: "REGULAR_SEASON",
        lastUpdated: "2026-09-19T19:30:00Z",
        homeTeam: { id: 86, name: "Real Madrid CF", shortName: "Real Madrid", tla: "RMA" },
        awayTeam: { id: 81, name: "FC Barcelona", shortName: "Barça", tla: "FCB" },
        score: {
          duration: "REGULAR",
          fullTime: { home: 1, away: 1 },
          halfTime: { home: 0, away: 1 },
        },
      },
      {
        id: 9,
        competition: { id: 9999, code: "XX", name: "Somewhere else" },
        utcDate: "2026-09-19T19:00:00Z",
        status: "FINISHED",
        matchday: 1,
        stage: "REGULAR_SEASON",
        lastUpdated: "2026-09-19T21:00:00Z",
        homeTeam: { id: 1, name: "Nowhere FC", shortName: "Nowhere", tla: "NOW" },
        awayTeam: { id: 2, name: "Elsewhere FC", shortName: "Elsewhere", tla: "ELS" },
        score: {
          duration: "REGULAR",
          fullTime: { home: 0, away: 0 },
          halfTime: { home: 0, away: 0 },
        },
      },
    ],
  };
  const teams = [
    { id: "arsenal", name: "Arsenal", shortName: "Arsenal" },
    { id: "chelsea", name: "Chelsea", shortName: "Chelsea" },
    { id: "real-madrid", name: "Real Madrid", shortName: "Real Madrid" },
    { id: "barcelona", name: "FC Barcelona", shortName: "Barcelona" },
  ];

  it("asks for every competition in one request and routes each match home", async () => {
    const calls: string[] = [];
    const p = new FootballDataProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...teams],
      noThrottle: true,
      fetchImpl: (async (url: string | URL | Request) => {
        calls.push(String(url));
        return new Response(JSON.stringify(across), { status: 200 });
      }) as typeof fetch,
    });
    const out = await p.fetchAcross([comp, laliga], {
      fromDate: "2026-09-19",
      toDate: "2026-09-20",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/matches?competitions=PL,PD&dateFrom=2026-09-19&dateTo=2026-09-20");
    // the third match belongs to a competition we did not ask about and is ignored
    expect(out).toHaveLength(2);
    expect(out[0].value).toMatchObject({
      competitionId: "epl",
      status: "finished",
      score: { home: 3, away: 0 },
    });
    expect(out[1].value).toMatchObject({
      competitionId: "laliga",
      status: "live",
      phase: "2H",
      score: { home: 1, away: 1 },
    });
    expect(p.requestsMade).toBe(1);
  });

  it("falls back to one request per competition when the combined endpoint is refused", async () => {
    const calls: string[] = [];
    const p = new FootballDataProvider({
      apiKey: "k",
      season: 2026,
      knownTeams: [...teams],
      noThrottle: true,
      fetchImpl: (async (url: string | URL | Request) => {
        const u = String(url);
        calls.push(u);
        if (u.includes("/matches?competitions=")) return new Response("no", { status: 403 });
        const code = /competitions\/(\w+)\//.exec(u)![1];
        return new Response(
          JSON.stringify({ matches: across.matches.filter((m) => m.competition.code === code) }),
          { status: 200 },
        );
      }) as typeof fetch,
    });
    const out = await p.fetchAcross([comp, laliga], {
      fromDate: "2026-09-19",
      toDate: "2026-09-20",
    });
    expect(calls).toHaveLength(3); // the refused combined call, then one per competition
    expect(out.map((r) => r.value.competitionId)).toEqual(["epl", "laliga"]);
  });
});
