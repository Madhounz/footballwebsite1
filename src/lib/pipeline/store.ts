import type { Competition } from "../types";
import type { ReconciledMatch } from "./reconcile";
import type { Conflict, Resolution } from "./types";

/** Where reconciled data lands. Prisma in production, a printer for --dry-run. */
export interface SyncStore {
  beginRun(trigger: string, providers: string[]): Promise<string>;
  upsertMatches(competition: Competition, matches: ReconciledMatch[]): Promise<number>;
  recordConflicts(
    runId: string,
    conflicts: Conflict[],
    resolutions: (Resolution | null)[],
  ): Promise<void>;
  finishRun(
    runId: string,
    stats: {
      fetched: number;
      written: number;
      conflicts: number;
      aiResolved: number;
      error?: string;
    },
  ): Promise<void>;
}

export class DryRunStore implements SyncStore {
  constructor(private readonly log: (line: string) => void = console.log) {}
  async beginRun(trigger: string, providers: string[]) {
    this.log(`[dry-run] run trigger=${trigger} providers=${providers.join(",") || "none"}`);
    return "dry-run";
  }
  async upsertMatches(competition: Competition, matches: ReconciledMatch[]) {
    for (const m of matches) {
      const v = m.value;
      const score = v.score ? `${v.score.home}-${v.score.away}` : "v";
      this.log(
        `[dry-run] ${competition.shortName} ${v.kickoff.slice(0, 16)} ${v.homeTeamId} ${score} ${v.awayTeamId} (${v.status}, confidence ${m.confidence})`,
      );
    }
    return matches.length;
  }
  async recordConflicts(_runId: string, conflicts: Conflict[], resolutions: (Resolution | null)[]) {
    conflicts.forEach((c, i) => {
      const r = resolutions[i];
      this.log(
        `[dry-run] conflict ${c.entityId}.${c.field} ${JSON.stringify(c.values)} -> ${r ? `${r.resolvedBy} ${JSON.stringify(r.value)} (${r.confidence})` : "unresolved"}`,
      );
    });
  }
  async finishRun(
    _runId: string,
    stats: {
      fetched: number;
      written: number;
      conflicts: number;
      aiResolved: number;
      error?: string;
    },
  ) {
    this.log(`[dry-run] done ${JSON.stringify(stats)}`);
  }
}
