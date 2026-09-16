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
  /** Maps football-data's scorer-chart players onto ours; without it no chart is fetched. */
  resolveScorerPlayer?: PlayerResolver;
  /** Spend API-Football requests on match details this run. */
  detailsEnabled: boolean;
  /** Also fill in older matches whose timeline never completed. */
  catchUp?: CatchUpWindow;
  /** Requests left below which catching up stops. Lower it for a deliberate repair run. */
  catchUpReserve?: number;
  /**
   * What this key has already spent today, read from the store. Without it the
   * metered provider believes every run is the day's first — which, in a
   * serverless refresh that starts afresh every minute, it always is.
   */
  spentToday?: number;
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
        resolvePlayer: setup.resolveScorerPlayer,
        onUnknownTeam: (n, id) => onUnknownTeam?.("football-data", n, id),
        log: setup.log,
      }),
    );
  }
  // A key can be alive and still not worth calling. An account under review is
  // the case this exists for: the budget below stops us at a hundred requests,
  // but a hundred refusals a day from a suspended key is not a thing to be
  // doing while somebody decides whether to trust us again. Unset it to switch
  // the provider back on; the key itself is left in place.
  const off = /^(1|true|yes)$/i.test(env.NINETY_API_FOOTBALL_OFF ?? "");
  if (off && env.API_FOOTBALL_KEY) {
    setup.log?.("api-football: switched off by NINETY_API_FOOTBALL_OFF; not called at all");
  }
  if (env.API_FOOTBALL_KEY && !off) {
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
        spentToday: setup.spentToday,
        seasonFetchEnabled: setup.seed ?? false,
        onUnknownTeam: (n, id) => onUnknownTeam?.("api-football", n, id),
        log: setup.log,
      }),
    );
  }
  return list;
}

export { FootballDataProvider, ApiFootballProvider };
