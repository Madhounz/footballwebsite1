/**
 * Brings `data/honours/*.json` up to date from football-data.
 *
 *   pnpm honours                      # add seasons the files are missing
 *   pnpm honours -- --dry-run         # print what would change, write nothing
 *   pnpm honours -- --all             # also backfill seasons older than the files
 *   pnpm honours -- --competitions epl,laliga
 *
 * Reads FOOTBALL_DATA_API_KEY. One request per competition, paced for the free
 * plan's ten a minute. A competition the plan refuses is reported and skipped —
 * the Europa League is not on the free tier, so its file stays hand-curated.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Honours, Team } from "../src/lib/types";
import { COMPETITION_CODES, resolveTeamId } from "../src/lib/pipeline/normalize";
import {
  entriesFromSeasons,
  mergeHonours,
  seasonLabel,
  type ProviderSeason,
} from "../src/lib/pipeline/honours-update";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const BASE = "https://api.football-data.org/v4";
/** The free plan allows ten requests a minute; leave room. */
const GAP_MS = 6_500;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface CompetitionResponse {
  name?: string;
  seasons?: ProviderSeason[];
}

async function main() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    console.error("FOOTBALL_DATA_API_KEY is not set.");
    process.exit(2);
  }
  const dryRun = flag("dry-run");
  const includeOlder = flag("all");
  const wanted = arg("competitions")?.split(",");

  const teamsJson = JSON.parse(
    fs.readFileSync(path.join(root, "data/demo/teams.json"), "utf8"),
  ) as {
    teams: [string, string, string, ...unknown[]][];
  };
  const knownTeams: Pick<Team, "id" | "name" | "shortName">[] = teamsJson.teams.map((t) => ({
    id: t[0],
    name: t[1],
    shortName: t[2],
  }));
  const resolve = (name: string) => {
    const id = resolveTeamId(name, knownTeams);
    const team = id ? knownTeams.find((t) => t.id === id) : null;
    return team ? { id: team.id, name: team.name } : null;
  };

  let changed = 0;
  let first = true;
  for (const [competitionId, codes] of Object.entries(COMPETITION_CODES)) {
    if (wanted && !wanted.includes(competitionId)) continue;
    if (!codes.footballData) continue;
    const file = path.join(root, `data/honours/${competitionId}.json`);
    if (!fs.existsSync(file)) {
      console.log(`${competitionId}: no honours file; skipped`);
      continue;
    }
    if (!first) await sleep(GAP_MS);
    first = false;

    let body: CompetitionResponse;
    try {
      const res = await fetch(`${BASE}/competitions/${codes.footballData}`, {
        headers: { "X-Auth-Token": apiKey },
      });
      if (res.status === 403) {
        console.log(`${competitionId}: not on this plan; left as it is`);
        continue;
      }
      if (!res.ok) {
        console.log(`${competitionId}: football-data ${res.status}; left as it is`);
        continue;
      }
      body = (await res.json()) as CompetitionResponse;
    } catch (e) {
      console.log(`${competitionId}: request failed (${String(e)}); left as it is`);
      continue;
    }
    if (!body.seasons?.length) {
      console.log(`${competitionId}: no seasons in the response; left as it is`);
      continue;
    }

    // "The file already has everything" and "the plan showed us nothing usable"
    // read identically from the outside, and they call for opposite responses:
    // one means the job is done, the other means a season has to be added by
    // hand. So the run says which of the two it was.
    const dated = body.seasons.filter((s) => s.startDate && s.endDate);
    const newest = [...dated].sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
    if (newest) {
      const label = seasonLabel(newest.startDate, newest.endDate);
      const who = newest.winner
        ? `won by ${newest.winner.name}`
        : "no winner named — either still being played, or not on this plan";
      console.log(`${competitionId}: ${dated.length} season(s) offered, newest ${label}, ${who}`);
    }

    const honours = JSON.parse(fs.readFileSync(file, "utf8")) as Honours;
    const rows = entriesFromSeasons(body.seasons, resolve);
    const result = mergeHonours(honours, rows, { includeOlder });

    for (const c of result.conflicts) {
      console.log(
        `${competitionId}: ${c.season} — the file says ${c.ours}, football-data says ${c.theirs}. Left as it is; decide by hand.`,
      );
    }
    if (result.skippedOlder.length) {
      console.log(
        `${competitionId}: ${result.skippedOlder.length} seasons older than the file were left out (use --all to add them)`,
      );
    }
    if (!result.added.length) {
      console.log(
        rows.length === 0
          ? `${competitionId}: no finished season with a named winner was offered, so there was nothing to add`
          : `${competitionId}: already up to date`,
      );
      continue;
    }
    const named = result.added
      .map((s) => `${s} ${result.honours.entries.find((e) => e.season === s)?.winner}`)
      .join(", ");
    console.log(`${competitionId}: ${dryRun ? "would add" : "added"} ${named}`);
    if (!dryRun) {
      fs.writeFileSync(file, `${JSON.stringify(result.honours, null, 2)}\n`);
      changed++;
    }
  }
  console.log(dryRun ? "dry run: nothing written" : `${changed} file(s) updated`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
