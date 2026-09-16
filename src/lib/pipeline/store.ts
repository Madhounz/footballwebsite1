import type { Competition } from "../types";
import type { ReconciledMatch } from "./reconcile";
import type { Conflict, DetailStore, PlayerResolver, ProviderTeam, Resolution } from "./types";

/** Where reconciled data lands. Prisma in production, a printer for --dry-run. */
export interface SyncStore extends DetailStore {
  beginRun(trigger: string, providers: string[], mode?: string): Promise<string>;
  /** True when a run started within `withinSeconds` and has not finished. Stops overlapping refreshes. */
  isSyncRunning(withinSeconds: number): Promise<boolean>;
  /** Minutes since the last run that spent detail requests, or null if there has never been one. */
  minutesSinceLastDetailRun(): Promise<number | null>;
  /** Metered detail requests spent since midnight UTC, where the provider's daily quota resets. */
  detailRequestsToday(now?: Date): Promise<number>;
  /** Delete every competition, team, player, match and event. Only for an explicit --reset. */
  reset(): Promise<void>;
  /** Whether any known match kicks off within [now - afterMin, now + beforeMin]. Gates paid detail fetches. */
  hasMatchesAround(now: Date, beforeMin: number, afterMin: number): Promise<boolean>;
  /** Player identity for providers that name players inside matches. */
  playerResolver(): PlayerResolver;
  /** Upsert a competition, the teams taking part this season and their squads. */
  seed(
    competition: Competition,
    teams: ProviderTeam[],
  ): Promise<{ teams: number; players: number }>;
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
      providerRequests?: Record<string, number>;
      error?: string;
    },
  ): Promise<void>;
}

export class DryRunStore implements SyncStore {
  constructor(private readonly log: (line: string) => void = console.log) {}
  async beginRun(trigger: string, providers: string[], mode = "full") {
    this.log(
      `[dry-run] run trigger=${trigger} mode=${mode} providers=${providers.join(",") || "none"}`,
    );
    return "dry-run";
  }
  async isSyncRunning() {
    return false;
  }
  async minutesSinceLastDetailRun() {
    return null;
  }
  async detailRequestsToday() {
    return 0;
  }
  async reset() {
    this.log("[dry-run] reset: would delete all competitions, teams, players and matches");
  }
  async hasMatchesAround() {
    return true;
  }
  async matchesNeedingDetail() {
    return [];
  }
  async saveMatchAlias() {}
  async startingPlayerIds() {
    return new Set<string>();
  }
  playerResolver(): PlayerResolver {
    return async (teamId, p) => `${teamId}:${p.externalId}`;
  }
  async seed(competition: Competition, teams: ProviderTeam[]) {
    const players = teams.reduce((n, t) => n + (t.squad?.length ?? 0), 0);
    this.log(`[dry-run] seed ${competition.shortName}: ${teams.length} teams, ${players} players`);
    for (const t of teams)
      if (t.isNew) this.log(`[dry-run]   new team ${t.id} "${t.name}" (${t.country})`);
    return { teams: teams.length, players };
  }
  async upsertMatches(competition: Competition, matches: ReconciledMatch[]) {
    for (const m of matches) {
      const v = m.value;
      if (m.detailOnly) {
        this.log(
          `[dry-run] ${competition.shortName} ${v.kickoff.slice(0, 16)} ${v.homeTeamId}-${v.awayTeamId}: detail only, ${v.events?.length ?? 0} events${v.eventsFinal ? " (complete)" : ""}`,
        );
        continue;
      }
      const score = v.score ? `${v.score.home}-${v.score.away}` : "v";
      const flag = m.disputedFields.length ? ` DISPUTED:${m.disputedFields.join("/")}` : "";
      this.log(
        `[dry-run] ${competition.shortName} ${v.kickoff.slice(0, 16)} ${v.homeTeamId} ${score} ${v.awayTeamId} (${v.status}, confidence ${m.confidence})${flag}`,
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
