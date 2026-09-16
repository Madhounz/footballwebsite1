import { getRepository } from "../data";
import { addDays, todayISO } from "../dates";
import { AIValidator } from "./ai-validator";
import { PrismaSyncStore } from "./prisma-store";
import { providersFromEnv } from "./providers";
import { runSync } from "./sync";

/**
 * The minute-by-minute refresh behind /api/sync.
 *
 * It is deliberately narrow: only the three days around today, one combined
 * request per provider, and the metered provider is touched only while a match
 * is actually in range and no more often than the detail interval. Everything
 * heavy — seasons, teams, squads — stays in the daily job.
 */

/** A run that started less than this ago and has not finished blocks a new one. */
const LOCK_SECONDS = 150;
/** Line-ups appear about an hour before kick-off. */
const DETAIL_BEFORE_MIN = 70;
/** Keep refreshing a match for this long after kick-off. */
const DETAIL_AFTER_MIN = 240;
/** Minutes between detail fetches, so a busy day cannot drain the daily budget. */
const DEFAULT_DETAIL_INTERVAL_MIN = 5;
/** Minutes between the slower passes that finish off old timelines. */
const CATCH_UP_INTERVAL_MIN = 20;
/** How far back to look for a match whose timeline never completed. */
const DEFAULT_CATCH_UP_DAYS = 45;
/** Matches one catch-up pass may take on. */
const CATCH_UP_LIMIT = 2;
/**
 * Metered requests a day may spend on old matches. The provider's own reserve
 * cannot help before the first response of a run tells it what is left, so the
 * day's spend so far — which we do store — decides whether to try at all.
 */
const CATCH_UP_DAILY_BUDGET = 40;

export interface LiveRefreshOutcome {
  ran: boolean;
  /** Why nothing was done, when `ran` is false. */
  skipped?: string;
  window: { fromDate: string; toDate: string };
  detailsEnabled: boolean;
  /** Whether this run was allowed to fill in older timelines, and what the day has spent. */
  catchUp: { enabled: boolean; detailRequestsToday: number };
  competitions: number;
  fetched: number;
  written: number;
  conflicts: number;
  unresolved: number;
  providerRequests: Record<string, number>;
  durationMs: number;
}

export interface LiveRefreshOptions {
  trigger?: string;
  /** Ignore the overlap lock. Only for manual debugging. */
  force?: boolean;
  log?: (line: string) => void;
}

export async function runLiveRefresh(opts: LiveRefreshOptions = {}): Promise<LiveRefreshOutcome> {
  const startedAt = Date.now();
  const log = opts.log ?? (() => {});
  const today = todayISO();
  const window = { fromDate: addDays(today, -1), toDate: addDays(today, 1) };
  const idle = (skipped: string, competitions = 0): LiveRefreshOutcome => ({
    ran: false,
    skipped,
    window,
    detailsEnabled: false,
    catchUp: { enabled: false, detailRequestsToday: 0 },
    competitions,
    fetched: 0,
    written: 0,
    conflicts: 0,
    unresolved: 0,
    providerRequests: {},
    durationMs: Date.now() - startedAt,
  });

  const store = new PrismaSyncStore();
  if (!opts.force && (await store.isSyncRunning(LOCK_SECONDS))) {
    return idle("another sync is already running");
  }

  const repo = await getRepository();
  const [competitions, teams] = await Promise.all([repo.listCompetitions(), repo.listTeams()]);
  if (competitions.length === 0) return idle("no competitions stored yet; run the seed job first");

  // Detail requests are metered. A match in range is worth the interval; with
  // nothing in range the pass runs far less often, and only to finish the
  // timelines of matches that were played while nobody was watching.
  const near = await store.hasMatchesAround(new Date(), DETAIL_BEFORE_MIN, DETAIL_AFTER_MIN);
  const sinceDetail = await store.minutesSinceLastDetailRun();
  const interval = Number(process.env.NINETY_DETAIL_INTERVAL_MIN ?? DEFAULT_DETAIL_INTERVAL_MIN);
  const wait = near ? interval : CATCH_UP_INTERVAL_MIN;
  const detailsEnabled = sinceDetail === null || sinceDetail >= wait;
  if (!detailsEnabled) {
    log(
      `details skipped: last detail run was ${Math.round(sinceDetail ?? 0)} min ago (every ${wait})`,
    );
  }
  const spentToday = await store.detailRequestsToday();
  const catchUp = spentToday < CATCH_UP_DAILY_BUDGET;
  if (detailsEnabled && !catchUp) {
    log(`catch-up paused: ${spentToday} detail requests spent today, keeping the rest for live`);
  }

  const seasonStartYear = Number(competitions[0].season.slice(0, 4));
  const providers = providersFromEnv(process.env, {
    knownTeams: teams.map((t) => ({ id: t.id, name: t.name, shortName: t.shortName })),
    seasonStartYear,
    resolvePlayer: store.playerResolver(),
    detailStore: store,
    detailsEnabled,
    catchUp: catchUp
      ? {
          days: Number(process.env.NINETY_CATCH_UP_DAYS ?? DEFAULT_CATCH_UP_DAYS),
          limit: CATCH_UP_LIMIT,
        }
      : undefined,
    seed: false,
    mode: "live",
    log,
  });
  if (providers.length === 0) {
    return idle(
      "no data providers configured: set FOOTBALL_DATA_API_KEY (and optionally API_FOOTBALL_KEY) where this runs",
      competitions.length,
    );
  }

  const result = await runSync({
    competitions,
    providers,
    window,
    store,
    ai: AIValidator.available() ? new AIValidator() : null,
    mode: "live",
    trigger: opts.trigger ?? "cron",
    log,
  });

  return {
    ran: true,
    window,
    detailsEnabled,
    catchUp: { enabled: catchUp, detailRequestsToday: spentToday },
    competitions: competitions.length,
    fetched: result.fetched,
    written: result.written,
    conflicts: result.conflicts,
    unresolved: result.unresolved.length,
    providerRequests: result.providerRequests,
    durationMs: Date.now() - startedAt,
  };
}
