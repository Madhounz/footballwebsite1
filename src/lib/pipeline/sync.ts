import type { Competition } from "../types";
import type { AIValidator } from "./ai-validator";
import { reconcileMatches, type ReconciledMatch } from "./reconcile";
import type { SyncStore } from "./store";
import type {
  Conflict,
  FetchWindow,
  Provider,
  ProviderMatch,
  ProviderRecord,
  Resolution,
} from "./types";

export interface SyncOptions {
  competitions: Competition[];
  providers: Provider[];
  window: FetchWindow;
  store: SyncStore;
  ai?: AIValidator | null;
  trigger?: string;
  /** Also fetch teams and squads and write them before matches. Needed on the first run. */
  seed?: boolean;
  /**
   * "full" walks the season competition by competition. "live" asks each
   * provider for every competition in one request, which is what the
   * minute-by-minute refresh needs.
   */
  mode?: "full" | "live";
  log?: (line: string) => void;
}

export interface SyncResult {
  seeded: { teams: number; players: number };
  fetched: number;
  written: number;
  conflicts: number;
  aiResolved: number;
  unresolved: Conflict[];
  /** "competition/provider" pairs that were skipped because the provider refused them. */
  skipped: string[];
  /** Requests each provider spent, for budget reporting. */
  providerRequests: Record<string, number>;
}

/**
 * fetch -> reconcile -> (ai) -> store, per competition. Provider failures are
 * isolated: one provider refusing a competition, or going down, degrades
 * confidence for that competition; it never stops the run.
 */
export async function runSync(opts: SyncOptions): Promise<SyncResult> {
  const log = opts.log ?? (() => {});
  const weights = Object.fromEntries(opts.providers.map((p) => [p.id, p.weight]));
  const mode = opts.mode ?? "full";
  const runId = await opts.store.beginRun(
    opts.trigger ?? "manual",
    opts.providers.map((p) => p.id),
    opts.seed ? "seed" : mode,
  );
  const result: SyncResult = {
    seeded: { teams: 0, players: 0 },
    fetched: 0,
    written: 0,
    conflicts: 0,
    aiResolved: 0,
    unresolved: [],
    skipped: [],
    providerRequests: {},
  };
  let error: string | undefined;
  // Providers that refused a competition (403) are not asked about it again this run.
  const refused = new Set<string>();
  // Teams whose squad was already written this run (a club in a league and a cup).
  const squadDone = new Set<string>();

  /** provider id -> competition id -> records, filled once when a provider can serve them together. */
  const prefetched = new Map<string, Map<string, ProviderRecord<ProviderMatch>[]>>();

  try {
    if (mode === "live") {
      for (const p of opts.providers) {
        if (!p.fetchAcross) continue;
        const supported = opts.competitions.filter((c) => p.supports(c.id));
        if (supported.length === 0) continue;
        try {
          const records = await p.fetchAcross(supported, opts.window);
          const grouped = new Map<string, ProviderRecord<ProviderMatch>[]>();
          for (const r of records) {
            const list = grouped.get(r.value.competitionId) ?? [];
            list.push(r);
            grouped.set(r.value.competitionId, list);
          }
          prefetched.set(p.id, grouped);
          log(
            `${p.id}: ${records.length} matches across ${supported.length} competitions in one pass`,
          );
        } catch (e) {
          log(
            `${p.id}: combined fetch failed, falling back per competition: ${String(e instanceof Error ? e.message : e)}`,
          );
        }
      }
    }

    for (const competition of opts.competitions) {
      const providers = opts.providers.filter((p) => p.supports(competition.id));
      if (providers.length === 0) {
        log(`skip ${competition.name}: no provider supports it`);
        continue;
      }

      if (opts.seed) await seedCompetition(competition, providers);

      const active = providers.filter((p) => !refused.has(`${competition.id}/${p.id}`));
      if (active.length === 0) {
        log(`${competition.shortName}: no provider can serve it; skipped`);
        continue;
      }
      const settled = await Promise.allSettled(
        active.map((p) => {
          const ready = prefetched.get(p.id);
          return ready
            ? Promise.resolve(ready.get(competition.id) ?? [])
            : p.fetchMatches(competition, opts.window);
        }),
      );
      const records: ProviderRecord<ProviderMatch>[] = [];
      const recency: Record<string, string | undefined> = {};
      settled.forEach((s, i) => {
        if (s.status === "fulfilled") {
          records.push(...s.value);
          recency[active[i].id] = s.value
            .map((r) => r.updatedAt)
            .filter(Boolean)
            .sort()
            .at(-1);
          log(`${competition.shortName}: ${active[i].id} returned ${s.value.length} matches`);
        } else {
          noteFailure(competition, active[i], s.reason);
        }
      });
      result.fetched += records.length;
      if (records.length === 0) continue;

      const { matches, needsReview } = reconcileMatches(records, weights);
      const allConflicts = matches.flatMap((m) => m.conflicts);
      result.conflicts += allConflicts.length;

      const resolutions: (Resolution | null)[] = allConflicts.map(
        (c) => (c.context.chosen as Resolution) ?? null,
      );
      if (opts.ai && needsReview.length) {
        log(`${competition.shortName}: asking the validator about ${needsReview.length} conflicts`);
        const decided = await opts.ai.resolveConflicts(needsReview, recency);
        needsReview.forEach((c, i) => {
          const r = decided[i];
          const idx = allConflicts.indexOf(c);
          resolutions[idx] = r;
          if (r.resolvedBy === "ai") {
            applyResolution(matches, c, r);
            result.aiResolved++;
          } else {
            result.unresolved.push(c);
          }
        });
      } else {
        result.unresolved.push(...needsReview);
      }

      const written = await opts.store.upsertMatches(competition, matches);
      result.written += written;
      log(`${competition.shortName}: wrote ${written} matches`);
      await opts.store.recordConflicts(runId, allConflicts, resolutions);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    log(`sync failed: ${error}`);
    throw e;
  } finally {
    for (const p of opts.providers) result.providerRequests[p.id] = p.requestsMade ?? 0;
    await opts.store.finishRun(runId, {
      fetched: result.fetched,
      written: result.written,
      conflicts: result.conflicts,
      aiResolved: result.aiResolved,
      providerRequests: result.providerRequests,
      error,
    });
  }
  return result;

  function noteFailure(competition: Competition, provider: Provider, reason: unknown) {
    const msg = String(reason instanceof Error ? reason.message : reason);
    const key = `${competition.id}/${provider.id}`;
    if (/\b403\b/.test(msg)) {
      refused.add(key);
      result.skipped.push(key);
      log(
        `${competition.shortName}: ${provider.id} does not offer this competition on your plan; skipped`,
      );
    } else {
      log(`${competition.shortName}: ${provider.id} failed: ${msg}`);
    }
  }

  /** The first provider that knows the competition's teams seeds it; others only cross-check results. */
  async function seedCompetition(competition: Competition, providers: Provider[]) {
    for (const p of providers) {
      let teams;
      try {
        teams = (await p.fetchTeams(competition)).map((r) => ({ record: r, team: r.value }));
      } catch (e) {
        noteFailure(competition, p, e);
        continue;
      }
      if (teams.length === 0) continue;

      // A cup's team list often carries no squads; fetch them per club, once per run.
      for (const { record, team } of teams) {
        if (squadDone.has(team.id)) {
          team.squad = [];
          continue;
        }
        if (!team.squad?.length) {
          try {
            team.squad = (await p.fetchSquad(record.externalId)).map((r) => r.value);
          } catch (e) {
            log(
              `${competition.shortName}: squad for ${team.id} failed: ${String(e instanceof Error ? e.message : e)}`,
            );
            team.squad = [];
          }
        }
        if (team.squad.length) squadDone.add(team.id);
      }

      const seeded = await opts.store.seed(
        competition,
        teams.map((t) => t.team),
      );
      result.seeded.teams += seeded.teams;
      result.seeded.players += seeded.players;
      const fresh = teams.filter((t) => t.team.isNew).map((t) => `${t.team.id} ("${t.team.name}")`);
      log(
        `${competition.shortName}: seeded ${seeded.teams} teams, ${seeded.players} players from ${p.id}${fresh.length ? `; new: ${fresh.join(", ")}` : ""}`,
      );
      return;
    }
  }
}

function applyResolution(matches: ReconciledMatch[], conflict: Conflict, resolution: Resolution) {
  const m = matches.find((x) => x.id === conflict.entityId);
  if (!m) return;
  (m.value as unknown as Record<string, unknown>)[conflict.field] = resolution.value;
  m.confidence = Math.max(m.confidence, resolution.confidence);
}
