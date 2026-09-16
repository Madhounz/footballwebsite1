import type { CatchUpWindow, DetailStore, PlayerResolver, Provider } from "../types";
import { FootballDataProvider } from "./football-data";
import { ApiFootballProvider } from "./api-football";

export type ProviderEnv = Record<string, string | undefined>;

/** Builds every provider that has credentials. Order does not matter; weights do. */
export interface ProviderSetup {
  knownTeams: { id: string; name: string; shortName: string }[];
  seasonStartYear: number;
  resolvePlayer: PlayerResolver;
  detailStore: DetailStore;
  /** Spend API-Football requests on match details this run. */
  detailsEnabled: boolean;
  /** Also fill in older matches whose timeline never completed. */
  catchUp?: CatchUpWindow;
  /** Requests left below which catching up stops. Lower it for a deliberate repair run. */
  catchUpReserve?: number;
  /** Seed runs may also pull whole-season fixture lists from the metered provider. */
  seed?: boolean;
  /** "live" paces football-data for a handful of calls rather than a season walk. */
  mode?: "full" | "live";
  onUnknownTeam?: (provider: string, name: string, externalId: string) => void;
  log?: (line: string) => void;
}

/** Builds every provider that has credentials. Order does not matter; weights do. */
export function providersFromEnv(env: ProviderEnv, setup: ProviderSetup): Provider[] {
  const { knownTeams, seasonStartYear, onUnknownTeam } = setup;
  const list: Provider[] = [];
  if (env.FOOTBALL_DATA_API_KEY) {
    list.push(
      new FootballDataProvider({
        apiKey: env.FOOTBALL_DATA_API_KEY,
        season: seasonStartYear,
        knownTeams,
        minGapMs: setup.mode === "live" ? 1_200 : undefined,
        onUnknownTeam: (n, id) => onUnknownTeam?.("football-data", n, id),
        log: setup.log,
      }),
    );
  }
  if (env.API_FOOTBALL_KEY) {
    list.push(
      new ApiFootballProvider({
        apiKey: env.API_FOOTBALL_KEY,
        season: seasonStartYear,
        knownTeams,
        resolvePlayer: setup.resolvePlayer,
        detailStore: setup.detailStore,
        // Competitions football-data's free tier refuses; API-Football carries the whole season for them.
        primaryFor: env.FOOTBALL_DATA_API_KEY
          ? ["uel"]
          : ["epl", "laliga", "bundesliga", "seriea", "ucl", "uel"],
        detailsEnabled: setup.detailsEnabled,
        catchUp: setup.catchUp,
        catchUpReserve: setup.catchUpReserve,
        seasonFetchEnabled: setup.seed ?? false,
        onUnknownTeam: (n, id) => onUnknownTeam?.("api-football", n, id),
        log: setup.log,
      }),
    );
  }
  return list;
}

export { FootballDataProvider, ApiFootballProvider };
