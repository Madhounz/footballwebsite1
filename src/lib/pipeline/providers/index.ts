import type { Provider } from "../types";
import { FootballDataProvider } from "./football-data";
import { ApiFootballProvider } from "./api-football";

export type ProviderEnv = Record<string, string | undefined>;

/** Builds every provider that has credentials. Order does not matter; weights do. */
export function providersFromEnv(
  env: ProviderEnv,
  knownTeams: { id: string; name: string; shortName: string }[],
  seasonStartYear: number,
  onUnknownTeam?: (provider: string, name: string, externalId: string) => void,
): Provider[] {
  const list: Provider[] = [];
  if (env.FOOTBALL_DATA_API_KEY) {
    list.push(
      new FootballDataProvider({
        apiKey: env.FOOTBALL_DATA_API_KEY,
        knownTeams,
        onUnknownTeam: (n, id) => onUnknownTeam?.("football-data", n, id),
      }),
    );
  }
  if (env.API_FOOTBALL_KEY) {
    list.push(
      new ApiFootballProvider({
        apiKey: env.API_FOOTBALL_KEY,
        season: seasonStartYear,
        knownTeams,
        onUnknownTeam: (n, id) => onUnknownTeam?.("api-football", n, id),
      }),
    );
  }
  return list;
}

export { FootballDataProvider, ApiFootballProvider };
