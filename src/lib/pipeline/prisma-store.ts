import { getPrisma } from "../db";
import type { Competition } from "../types";
import type { ReconciledMatch } from "./reconcile";
import type { SyncStore } from "./store";
import type { Conflict, Resolution } from "./types";

export class PrismaSyncStore implements SyncStore {
  private get db() {
    return getPrisma();
  }

  async beginRun(trigger: string, providers: string[]) {
    const run = await this.db.syncRun.create({ data: { trigger, providers } });
    return run.id;
  }

  async upsertMatches(competition: Competition, matches: ReconciledMatch[]) {
    let n = 0;
    for (const m of matches) {
      const v = m.value;
      const data = {
        competitionId: competition.id,
        season: competition.season,
        round: v.round,
        stage: v.stage ?? null,
        kickoff: new Date(v.kickoff),
        homeTeamId: v.homeTeamId,
        awayTeamId: v.awayTeamId,
        status: v.status,
        phase: v.phase ?? "NS",
        minute: v.minute ?? null,
        homeScore: v.score?.home ?? null,
        awayScore: v.score?.away ?? null,
        homeHtScore: v.halfTimeScore?.home ?? null,
        awayHtScore: v.halfTimeScore?.away ?? null,
        venue: v.venue ?? null,
        attendance: v.attendance ?? null,
        referee: v.referee ?? null,
        confidence: m.confidence,
      };
      await this.db.match.upsert({
        where: { id: m.id },
        create: { id: m.id, ...data },
        update: data,
      });
      if (v.events?.length) {
        await this.db.matchEvent.deleteMany({ where: { matchId: m.id } });
        await this.db.matchEvent.createMany({
          data: v.events.map((e, i) => ({
            id: `${m.id}-e${i}`,
            matchId: m.id,
            minute: e.minute,
            addedTime: e.addedTime ?? null,
            teamId: e.teamId,
            type: e.type,
            playerId: e.playerId,
            relatedPlayerId: e.relatedPlayerId ?? null,
            detail: e.detail ?? null,
          })),
        });
      }
      n++;
    }
    return n;
  }

  async recordConflicts(runId: string, conflicts: Conflict[], resolutions: (Resolution | null)[]) {
    if (!conflicts.length) return;
    await this.db.discrepancy.createMany({
      data: conflicts.map((c, i) => {
        const r = resolutions[i];
        return {
          runId,
          entityType: c.entityType,
          entityId: c.entityId,
          field: c.field,
          values: c.values as object,
          resolution: r?.value === undefined ? undefined : (r?.value as object),
          resolvedBy: r?.resolvedBy ?? "unresolved",
          confidence: r?.confidence ?? null,
          reasoning: r?.reasoning ?? null,
          resolvedAt: r && r.resolvedBy !== "unresolved" ? new Date() : null,
        };
      }),
    });
  }

  async finishRun(
    runId: string,
    stats: {
      fetched: number;
      written: number;
      conflicts: number;
      aiResolved: number;
      error?: string;
    },
  ) {
    await this.db.syncRun.update({
      where: { id: runId },
      data: { finishedAt: new Date(), ...stats },
    });
  }
}
