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
  log?: (line: string) => void;
}

export interface SyncResult {
  fetched: number;
  written: number;
  conflicts: number;
  aiResolved: number;
  unresolved: Conflict[];
}

/**
 * fetch -> reconcile -> (ai) -> store, per competition. Provider failures are
 * isolated: one provider going down degrades confidence, it never stops the run.
 */
export async function runSync(opts: SyncOptions): Promise<SyncResult> {
  const log = opts.log ?? (() => {});
  const weights = Object.fromEntries(opts.providers.map((p) => [p.id, p.weight]));
  const runId = await opts.store.beginRun(
    opts.trigger ?? "manual",
    opts.providers.map((p) => p.id),
  );
  const result: SyncResult = {
    fetched: 0,
    written: 0,
    conflicts: 0,
    aiResolved: 0,
    unresolved: [],
  };
  let error: string | undefined;

  try {
    for (const competition of opts.competitions) {
      const providers = opts.providers.filter((p) => p.supports(competition.id));
      if (providers.length === 0) {
        log(`skip ${competition.name}: no provider supports it`);
        continue;
      }
      const settled = await Promise.allSettled(
        providers.map((p) => p.fetchMatches(competition, opts.window)),
      );
      const records: ProviderRecord<ProviderMatch>[] = [];
      const recency: Record<string, string | undefined> = {};
      settled.forEach((s, i) => {
        if (s.status === "fulfilled") {
          records.push(...s.value);
          recency[providers[i].id] = s.value
            .map((r) => r.updatedAt)
            .filter(Boolean)
            .sort()
            .at(-1);
          log(`${competition.shortName}: ${providers[i].id} returned ${s.value.length} matches`);
        } else {
          log(`${competition.shortName}: ${providers[i].id} failed: ${String(s.reason)}`);
        }
      });
      result.fetched += records.length;

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
          if (r.resolvedBy === "ai") {
            resolutions[idx] = r;
            applyResolution(matches, c, r);
            result.aiResolved++;
          } else {
            resolutions[idx] = r;
            result.unresolved.push(c);
          }
        });
      } else {
        result.unresolved.push(...needsReview);
      }

      result.written += await opts.store.upsertMatches(competition, matches);
      await opts.store.recordConflicts(runId, allConflicts, resolutions);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    log(`sync failed: ${error}`);
    throw e;
  } finally {
    await opts.store.finishRun(runId, {
      fetched: result.fetched,
      written: result.written,
      conflicts: result.conflicts,
      aiResolved: result.aiResolved,
      error,
    });
  }
  return result;
}

function applyResolution(matches: ReconciledMatch[], conflict: Conflict, resolution: Resolution) {
  const m = matches.find((x) => x.id === conflict.entityId);
  if (!m) return;
  (m.value as unknown as Record<string, unknown>)[conflict.field] = resolution.value;
  m.confidence = Math.max(m.confidence, resolution.confidence);
}
