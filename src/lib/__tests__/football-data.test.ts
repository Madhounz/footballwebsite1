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
