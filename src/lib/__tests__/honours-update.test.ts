import { describe, expect, it } from "vitest";
import {
  entriesFromSeasons,
  mergeHonours,
  seasonLabel,
  type ProviderSeason,
} from "../pipeline/honours-update";
import type { Honours } from "../types";

const known: Record<string, { id: string; name: string }> = {
  "Arsenal FC": { id: "arsenal", name: "Arsenal" },
  "Liverpool FC": { id: "liverpool", name: "Liverpool" },
};
const resolve = (name: string) => known[name] ?? null;

const season = (start: string, end: string, winner: string | null): ProviderSeason => ({
  startDate: start,
  endDate: end,
  winner: winner ? { id: 1, name: winner } : null,
});

const file = (): Honours => ({
  competitionId: "epl",
  name: "Premier League",
  entries: [
    {
      season: "2024/25",
      winner: "Liverpool",
      runnerUp: "Arsenal",
      detail: "20th English title",
      winnerTeamId: "liverpool",
      runnerUpTeamId: "arsenal",
    },
    { season: "2023/24", winner: "Manchester City", winnerTeamId: "manchester-city" },
  ],
  mostTitles: [
    { team: "Liverpool", count: 20, teamId: "liverpool" },
    { team: "Arsenal", count: 13, teamId: "arsenal" },
  ],
});

describe("seasonLabel", () => {
  it("spans two calendar years", () => {
    expect(seasonLabel("2025-08-15", "2026-05-24")).toBe("2025/26");
  });
  it("keeps a single-year tournament to its year", () => {
    expect(seasonLabel("2026-06-11", "2026-07-19")).toBe("2026");
  });
});

describe("entriesFromSeasons", () => {
  it("names the winner as we know them, not as the provider spells it", () => {
    const rows = entriesFromSeasons([season("2025-08-15", "2026-05-24", "Arsenal FC")], resolve);
    expect(rows[0].entry).toEqual({
      season: "2025/26",
      winner: "Arsenal",
      winnerTeamId: "arsenal",
    });
  });
  it("keeps a club we do not have, without pretending to an id", () => {
    const rows = entriesFromSeasons([season("2025-08-15", "2026-05-24", "Girona FC")], resolve);
    expect(rows[0].entry).toEqual({ season: "2025/26", winner: "Girona FC" });
  });
  it("ignores a season still being played", () => {
    expect(entriesFromSeasons([season("2026-08-14", "2027-05-23", null)], resolve)).toEqual([]);
  });
});

describe("mergeHonours", () => {
  it("adds the season that just finished and counts the title", () => {
    const rows = entriesFromSeasons([season("2025-08-15", "2026-05-24", "Arsenal FC")], resolve);
    const { honours, added } = mergeHonours(file(), rows);
    expect(added).toEqual(["2025/26"]);
    expect(honours.entries[0]).toMatchObject({ season: "2025/26", winnerTeamId: "arsenal" });
    // The tally is all-time, so it moves by one rather than being recounted.
    expect(honours.mostTitles).toEqual([
      { team: "Liverpool", count: 20, teamId: "liverpool" },
      { team: "Arsenal", count: 14, teamId: "arsenal" },
    ]);
  });

  it("never overwrites a curated entry, and says so when the provider disagrees", () => {
    const rows = entriesFromSeasons([season("2024-08-16", "2025-05-25", "Arsenal FC")], resolve);
    const { honours, added, conflicts } = mergeHonours(file(), rows);
    expect(added).toEqual([]);
    expect(conflicts).toEqual([{ season: "2024/25", ours: "Liverpool", theirs: "Arsenal" }]);
    expect(honours.entries[0].detail).toBe("20th English title");
  });

  it("leaves seasons older than the file alone unless asked", () => {
    const rows = entriesFromSeasons([season("2019-08-09", "2020-07-26", "Liverpool FC")], resolve);
    expect(mergeHonours(file(), rows).skippedOlder).toEqual(["2019/20"]);
    expect(mergeHonours(file(), rows, { includeOlder: true }).added).toEqual(["2019/20"]);
  });

  it("keeps the list newest first", () => {
    const rows = entriesFromSeasons(
      [
        season("2025-08-15", "2026-05-24", "Arsenal FC"),
        season("2024-08-16", "2025-05-25", "Liverpool FC"),
      ],
      resolve,
    );
    const { honours } = mergeHonours(file(), rows);
    expect(honours.entries.map((e) => e.season)).toEqual(["2025/26", "2024/25", "2023/24"]);
  });
});
