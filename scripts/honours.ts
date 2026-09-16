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
 *
 * What the free plan will not do, as of September 2026: name the winner of a
 * recent season. It gives Blackburn for 1994/95 and nothing at all for 2024/25,
 * 2025/26 or the season in play, across every competition we cover. So this
 * script cannot bring a list up to date on that plan, this month or next year,
 * and the champions of a season just ended are added by hand from a source the
 * site's owner supplies. It is still worth running: it reports what the plan
 * offers, so the day that changes we will see it rather than assume it.
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
    // read identically from the outside and call for opposite responses: one
    // means the job is done, the other that a season has to be added by hand.
    // The newest three, because the season worth knowing about is rarely the
    // newest — the one in play has no winner and should not, while the one that
    // ended in May either names a champion or proves the plan will not.
    const dated = body.seasons.filter((s) => s.startDate && s.endDate);
    const recent = [...dated].sort((a, b) => b.endDate.localeCompare(a.endDate)).slice(0, 3);
    if (recent.length) {
      const said = recent
        .map((s) => {
          const label = seasonLabel(s.startDate, s.endDate);
          return `${label} ${s.winner ? s.winner.name : "(no winner named)"}`;
        })
        .join(", ");
      console.log(`${competitionId}: ${dated.length} season(s) offered; newest are ${said}`);
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
