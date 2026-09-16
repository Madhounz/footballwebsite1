import { describe, expect, it } from "vitest";
import { providersFromEnv, type ProviderSetup } from "../pipeline/providers";
import type { DetailStore } from "../pipeline/types";

// Only what construction reads; nothing here makes a request.
const setup = {
  knownTeams: [],
  seasonStartYear: 2026,
  resolvePlayer: async () => "",
  detailStore: {} as DetailStore,
  detailsEnabled: false,
} satisfies ProviderSetup;

const ids = (env: Record<string, string | undefined>) =>
  providersFromEnv(env, setup).map((p) => p.id);

describe("providersFromEnv", () => {
  it("builds a provider for each key that is present", () => {
    expect(ids({})).toEqual([]);
    expect(ids({ FOOTBALL_DATA_API_KEY: "a" })).toEqual(["football-data"]);
    expect(ids({ API_FOOTBALL_KEY: "b" })).toEqual(["api-football"]);
    expect(ids({ FOOTBALL_DATA_API_KEY: "a", API_FOOTBALL_KEY: "b" })).toEqual([
      "football-data",
      "api-football",
    ]);
  });

  it("leaves the metered provider out entirely when it is switched off", () => {
    // Not a smaller budget — no requests at all, which is the only thing worth
    // saying to a provider reviewing whether to trust the key again.
    const env = { FOOTBALL_DATA_API_KEY: "a", API_FOOTBALL_KEY: "b" };
    for (const value of ["1", "true", "TRUE", "yes"]) {
      expect(ids({ ...env, NINETY_API_FOOTBALL_OFF: value })).toEqual(["football-data"]);
    }
    // Anything else leaves it on, so a stray value cannot silently stop the site
    // fetching line-ups.
    for (const value of ["", "0", "false", "no", "off"]) {
      expect(ids({ ...env, NINETY_API_FOOTBALL_OFF: value })).toEqual([
        "football-data",
        "api-football",
      ]);
    }
  });
});
