/**
 * Runs the data pipeline once.
 *
 *   pnpm sync                      # today ±1 day, every configured provider, write to DB
 *   pnpm sync -- --dry-run         # print instead of writing (no DATABASE_URL needed)
 *   pnpm sync -- --from 2026-09-01 --to 2026-09-30 --competitions epl,ucl
 *   pnpm sync -- --no-ai           # deterministic reconciliation only
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
  const window = {
    fromDate: arg("from") ?? addDays(today, -1),
    toDate: arg("to") ?? addDays(today, 1),
  };
  const dryRun = flag("dry-run");
  const useAI = !flag("no-ai") && AIValidator.available();

  // Competition and team definitions are seeded from the same JSON the demo uses.
  const competitionsSrc = JSON.parse(
    fs.readFileSync(path.join(root, "data/demo/competitions.json"), "utf8"),
  ) as Omit<Competition, "season">[];
  const seasonStart =
    today.slice(5) >= "07-01" ? Number(today.slice(0, 4)) : Number(today.slice(0, 4)) - 1;
  const season = `${seasonStart}/${String(seasonStart + 1).slice(2)}`;
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

  const unknown = new Map<string, { provider: string; externalId: string }>();
  const providers = providersFromEnv(
    process.env,
    knownTeams,
    seasonStart,
    (provider, name, externalId) => unknown.set(name, { provider, externalId }),
  );
  if (providers.length === 0) {
    console.error("No providers configured. Set FOOTBALL_DATA_API_KEY and/or API_FOOTBALL_KEY.");
    process.exit(2);
  }

  const store = dryRun
    ? new DryRunStore()
    : new (await import("../src/lib/pipeline/prisma-store")).PrismaSyncStore();
  const ai = useAI ? new AIValidator() : null;
  console.log(
    `sync ${window.fromDate}..${window.toDate} season=${season} providers=${providers.map((p) => p.id).join(",")} ai=${ai ? ai.model : "off"} ${dryRun ? "(dry run)" : ""}`,
  );

  const result = await runSync({
    competitions,
    providers,
    window,
    store,
    ai,
    trigger: process.env.GITHUB_ACTIONS ? "cron" : "manual",
    log: console.log,
  });

  if (unknown.size) {
    console.log(`\n${unknown.size} provider team names matched nothing:`);
    for (const [name, meta] of unknown)
      console.log(`  ${meta.provider} #${meta.externalId} "${name}"`);
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
      console.log("Add confirmed matches to TEAM_ALIASES in src/lib/pipeline/normalize.ts.");
    }
  }
  console.log(
    `\nfetched ${result.fetched}, written ${result.written}, conflicts ${result.conflicts}, ai-resolved ${result.aiResolved}, unresolved ${result.unresolved.length}`,
  );
  if (result.unresolved.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
