/**
 * Runs the data pipeline once.
 *
 *   pnpm sync                         # whole current season, every configured provider, write to DB
 *   pnpm sync -- --seed               # also fetch teams + squads first (required on the first run)
 *   pnpm sync -- --seed --reset       # wipe competitions/teams/players/matches first, then seed
 *   pnpm sync -- --dry-run            # print instead of writing (no DATABASE_URL needed)
 *   pnpm sync -- --from 2026-09-01 --to 2026-09-30 --competitions epl,ucl
 *   pnpm sync -- --no-ai              # deterministic reconciliation only
 *   pnpm sync -- --details            # force API-Football match details even with no match near kick-off
 *   pnpm sync -- --live               # today only, one combined request per provider (what /api/sync runs)
 *
 * Reads FOOTBALL_DATA_API_KEY, API_FOOTBALL_KEY, ANTHROPIC_API_KEY, DATABASE_URL.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addDays, todayISO } from "../src/lib/dates";
import type { Competition, Team } from "../src/lib/types";
import { AIValidator } from "../src/lib/pipeline/ai-validator";
import { providersFromEnv } from "../src/lib/pipeline/providers";
import { DryRunStore } from "../src/lib/pipeline/store";
import { runSync } from "../src/lib/pipeline/sync";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const today = todayISO();
  // European seasons run July -> June.
  const seasonStart =
    today.slice(5) >= "07-01" ? Number(today.slice(0, 4)) : Number(today.slice(0, 4)) - 1;
  const season = `${seasonStart}/${String(seasonStart + 1).slice(2)}`;
  const live = flag("live");
  const window = {
    fromDate: arg("from") ?? (live ? addDays(today, -1) : `${seasonStart}-07-01`),
    toDate: arg("to") ?? (live ? addDays(today, 1) : `${seasonStart + 1}-06-30`),
  };
  const dryRun = flag("dry-run");
  const seed = flag("seed");
  const reset = flag("reset");
  if (reset && !seed) {
    console.error("--reset only makes sense together with --seed.");
    process.exit(2);
  }
  const useAI = !flag("no-ai") && AIValidator.available();

  // Competition definitions and the starting alias list come from the same JSON the demo uses.
  const competitionsSrc = JSON.parse(
    fs.readFileSync(path.join(root, "data/demo/competitions.json"), "utf8"),
  ) as Omit<Competition, "season">[];
  const wanted = arg("competitions")?.split(",");
  const competitions: Competition[] = competitionsSrc
    .map((c) => ({ ...c, season }))
    .filter((c) => !wanted || wanted.includes(c.id));
  const teamsJson = JSON.parse(
    fs.readFileSync(path.join(root, "data/demo/teams.json"), "utf8"),
  ) as { teams: [string, string, string, ...unknown[]][] };
  const knownTeams: Pick<Team, "id" | "name" | "shortName">[] = teamsJson.teams.map((t) => ({
    id: t[0],
    name: t[1],
    shortName: t[2],
  }));

  const store = dryRun
    ? new DryRunStore()
    : new (await import("../src/lib/pipeline/prisma-store")).PrismaSyncStore();
  // Match details cost API-Football requests; only spend them when a match is near kick-off, live, or just finished.
  const detailsEnabled =
    seed || flag("details") || (await store.hasMatchesAround(new Date(), 70, 240));

  const unknown = new Map<string, { provider: string; externalId: string }>();
  const providers = providersFromEnv(process.env, {
    knownTeams,
    seasonStartYear: seasonStart,
    resolvePlayer: store.playerResolver(),
    detailStore: store,
    detailsEnabled,
    seed,
    mode: live ? "live" : "full",
    onUnknownTeam: (provider, name, externalId) => unknown.set(name, { provider, externalId }),
    log: console.log,
  });
  if (providers.length === 0) {
    console.error("No providers configured. Set FOOTBALL_DATA_API_KEY and/or API_FOOTBALL_KEY.");
    process.exit(2);
  }
  const ai = useAI ? new AIValidator() : null;
  console.log(
    `sync ${window.fromDate}..${window.toDate} season=${season} providers=${providers.map((p) => p.id).join(",")} ai=${ai ? ai.model : "off"} seed=${seed} mode=${live ? "live" : "full"} details=${detailsEnabled} ${dryRun ? "(dry run)" : ""}`,
  );

  if (reset) {
    console.log("resetting: deleting competitions, teams, players and matches");
    await store.reset();
  }

  const result = await runSync({
    competitions,
    providers,
    window,
    store,
    ai,
    seed,
    mode: live ? "live" : "full",
    trigger: process.env.GITHUB_ACTIONS ? "cron" : "manual",
    log: console.log,
  });

  if (unknown.size) {
    console.log(
      `\n${unknown.size} provider team names matched nothing (their matches were skipped):`,
    );
    for (const [name, meta] of unknown)
      console.log(`  ${meta.provider} #${meta.externalId} "${name}"`);
    console.log(
      seed
        ? "Add them to TEAM_ALIASES in src/lib/pipeline/normalize.ts if they are existing clubs."
        : "Run with --seed so the provider's team list creates them.",
    );
    if (ai) {
      const matches = await ai.matchEntities(
        "team",
        [...unknown.keys()],
        knownTeams.map((t) => ({ id: t.id, name: t.name })),
      );
      for (const m of matches)
        console.log(
          `  → "${m.providerName}" = ${m.canonicalId ?? "unresolved"} (${m.confidence}) ${m.reasoning}`,
        );
    }
  }
  const af = providers.find((p) => p.id === "api-football") as
    { requestsMade?: number; remaining?: number | null } | undefined;
  if (af)
    console.log(
      `api-football: ${af.requestsMade ?? 0} requests this run, ${af.remaining ?? "?"} left today`,
    );
  console.log(
    `\nseeded ${result.seeded.teams} teams / ${result.seeded.players} players, fetched ${result.fetched}, written ${result.written}, conflicts ${result.conflicts}, ai-resolved ${result.aiResolved}, unresolved ${result.unresolved.length}${result.skipped.length ? `, skipped ${result.skipped.join(" ")}` : ""}`,
  );
  if (result.unresolved.length) {
    console.log(
      `${result.unresolved.length} conflicts were left to the heavier provider; set ANTHROPIC_API_KEY to have them reviewed.`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
