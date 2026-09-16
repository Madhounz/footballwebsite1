/**
 * What can our keys actually see?
 *
 *   pnpm providers                    # both providers
 *   pnpm providers -- --countries "Saudi Arabia,Egypt"
 *
 * Adding a competition is a data question before it is a code question, and
 * the answer changes with the plan rather than with anything in this repo. So
 * ask, rather than remember: football-data lists every competition a key may
 * read, and API-Football states the plan, the daily allowance and which seasons
 * of a league it will serve.
 *
 * Reads FOOTBALL_DATA_API_KEY and API_FOOTBALL_KEY. Costs one request to
 * football-data and one per country (plus one status call) to API-Football.
 */
import { COMPETITION_CODES } from "../src/lib/pipeline/normalize";

const FD = "https://api.football-data.org/v4";
const AF = "https://v3.football.api-sports.io";
/** Countries worth asking about: the ones we cover, then the ones we might. */
const DEFAULT_COUNTRIES = ["Saudi Arabia", "Egypt", "United Arab Emirates", "Qatar"];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface FDCompetition {
  id: number;
  name: string;
  code: string;
  type: string;
  area: { name: string };
  plan: string;
  currentSeason?: { startDate: string; endDate: string } | null;
}

async function footballData(apiKey: string) {
  console.log("\n── football-data ──────────────────────────────────────────");
  const res = await fetch(`${FD}/competitions`, { headers: { "X-Auth-Token": apiKey } });
  if (!res.ok) {
    console.log(`  cannot list competitions: ${res.status}`);
    return;
  }
  const body = (await res.json()) as { competitions?: FDCompetition[] };
  const all = body.competitions ?? [];
  console.log(`  ${all.length} competitions available to this key\n`);
  const ours = new Set(Object.values(COMPETITION_CODES).map((c) => c.footballData));
  const leagues = all.filter((c) => c.type === "LEAGUE");
  const cups = all.filter((c) => c.type === "CUP");
  const line = (c: FDCompetition) =>
    `    ${c.code.padEnd(5)} ${c.name} (${c.area.name})${ours.has(c.code) ? "  ← already covered" : ""}`;
  console.log("  Leagues:");
  for (const c of leagues) console.log(line(c));
  if (cups.length) {
    console.log("  Cups:");
    for (const c of cups) console.log(line(c));
  } else {
    console.log("  Cups: none on this plan");
  }
  const missing = [...ours].filter((code) => code && !all.some((c) => c.code === code));
  if (missing.length) {
    console.log(`\n  We ask for these but the plan does not serve them: ${missing.join(", ")}`);
  }

  await matchDetail(apiKey, all);
}

interface FDSide {
  formation?: string | null;
  lineup?: unknown[] | null;
  bench?: unknown[] | null;
  coach?: { name?: string | null } | null;
}
interface FDMatch {
  id: number;
  utcDate: string;
  homeTeam: FDSide & { name?: string };
  awayTeam: FDSide & { name?: string };
  goals?: unknown[] | null;
  bookings?: unknown[] | null;
  substitutions?: unknown[] | null;
  referees?: unknown[] | null;
}

/**
 * Does this key get line-ups, or only a scoreline?
 *
 * The question matters more than it looks: line-ups and the formation are the
 * part of a match page people actually come for, and they have only ever come
 * from the metered provider. If football-data serves them too, a match page
 * stops depending on one free plan staying healthy. The v4 match resource has
 * fields for all of it; whether a given plan fills them in is a plan question,
 * and the only honest way to answer it is to fetch one real match and look.
 *
 * Costs two requests: one finished match from a competition we cover, then
 * that match by id.
 */
async function matchDetail(apiKey: string, all: FDCompetition[]) {
  console.log("\n  Match detail (what a match page could show without API-Football):");
  const code = [...coveredCodes(all)][0];
  if (!code) {
    console.log("    no covered competition on this key; skipped");
    return;
  }
  const headers = { "X-Auth-Token": apiKey };
  const listRes = await fetch(`${FD}/competitions/${code}/matches?status=FINISHED`, { headers });
  if (!listRes.ok) {
    console.log(`    ${code} finished matches: HTTP ${listRes.status}`);
    return;
  }
  const list = (await listRes.json()) as { matches?: { id: number; utcDate: string }[] };
  const last = (list.matches ?? []).sort((a, b) => b.utcDate.localeCompare(a.utcDate))[0];
  if (!last) {
    console.log(`    ${code}: no finished match to look at yet`);
    return;
  }
  const res = await fetch(`${FD}/matches/${last.id}`, { headers });
  if (!res.ok) {
    console.log(`    /matches/${last.id}: HTTP ${res.status}`);
    return;
  }
  const m = (await res.json()) as FDMatch;
  const count = (v: unknown[] | null | undefined) => (Array.isArray(v) ? v.length : "absent");
  const side = (label: string, t: FDSide & { name?: string }) =>
    console.log(
      `    ${label.padEnd(5)} ${t.name ?? "?"}: formation ${t.formation ?? "absent"}, ` +
        `lineup ${count(t.lineup)}, bench ${count(t.bench)}, coach ${t.coach?.name ?? "absent"}`,
    );
  console.log(`    ${code} match ${m.id}, ${m.utcDate.slice(0, 10)}`);
  side("home", m.homeTeam);
  side("away", m.awayTeam);
  console.log(
    `    goals ${count(m.goals)}, bookings ${count(m.bookings)}, ` +
      `substitutions ${count(m.substitutions)}, referees ${count(m.referees)}`,
  );
  console.log(
    "    A count of 0 means the plan serves the field but not the data; 'absent'\n" +
      "    means the plan does not serve it at all.",
  );
}

/** The football-data codes we already cover, in the order this repo lists them. */
function coveredCodes(all: FDCompetition[]): Set<string> {
  const wanted = Object.values(COMPETITION_CODES)
    .map((c) => c.footballData)
    .filter((c): c is string => Boolean(c));
  return new Set(wanted.filter((code) => all.some((c) => c.code === code)));
}

interface AFLeague {
  league: { id: number; name: string; type: string };
  country: { name: string };
  seasons: { year: number; current: boolean; coverage?: { fixtures?: { events?: boolean } } }[];
}

async function apiFootball(apiKey: string, countries: string[]) {
  console.log("\n── API-Football ───────────────────────────────────────────");
  const get = async <T>(path: string): Promise<T | null> => {
    const res = await fetch(`${AF}${path}`, { headers: { "x-apisports-key": apiKey } });
    if (!res.ok) {
      console.log(`  ${path}: HTTP ${res.status}`);
      return null;
    }
    const body = (await res.json()) as { response: T; errors?: unknown };
    const errors = body.errors;
    if (errors && typeof errors === "object" && Object.keys(errors as object).length) {
      console.log(`  ${path}: ${JSON.stringify(errors)}`);
      return null;
    }
    return body.response;
  };

  const status = await get<{
    subscription: { plan: string; end: string };
    requests: { current: number; limit_day: number };
  }>("/status");
  if (status) {
    console.log(
      `  plan: ${status.subscription.plan} · ${status.requests.current}/${status.requests.limit_day} requests used today`,
    );
  }

  for (const country of countries) {
    const leagues = await get<AFLeague[]>(`/leagues?country=${encodeURIComponent(country)}`);
    if (!leagues) continue;
    console.log(`\n  ${country}: ${leagues.length} competitions`);
    for (const l of leagues.slice(0, 8)) {
      const years = l.seasons.map((s) => s.year);
      const newest = Math.max(...years);
      const current = l.seasons.find((s) => s.current)?.year;
      const events = l.seasons.at(-1)?.coverage?.fixtures?.events ? "events" : "no events";
      console.log(
        `    ${String(l.league.id).padEnd(5)} ${l.league.name} (${l.league.type}) — seasons to ${newest}${
          current ? `, current ${current}` : ""
        }, ${events}`,
      );
    }
  }
  console.log(
    "\n  A season the plan will not serve simply does not appear above; that is the\n  wall a free key hits on a current season.",
  );
}

async function main() {
  const countries = (arg("countries") ?? DEFAULT_COUNTRIES.join(","))
    .split(",")
    .map((c) => c.trim());
  const fdKey = process.env.FOOTBALL_DATA_API_KEY;
  const afKey = process.env.API_FOOTBALL_KEY;
  if (!fdKey && !afKey) {
    console.error("Set FOOTBALL_DATA_API_KEY and/or API_FOOTBALL_KEY.");
    process.exit(2);
  }
  if (fdKey) await footballData(fdKey);
  else console.log("\nFOOTBALL_DATA_API_KEY is not set; skipped.");
  if (afKey) await apiFootball(afKey, countries);
  else console.log("\nAPI_FOOTBALL_KEY is not set; skipped.");
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
