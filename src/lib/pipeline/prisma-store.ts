import { getPrisma } from "../db";
import type { Competition } from "../types";
import type { ReconciledMatch } from "./reconcile";
import type { SyncStore } from "./store";
import { slugify } from "../slug";
import type { Conflict, ProviderTeam, Resolution } from "./types";

export class PrismaSyncStore implements SyncStore {
  private get db() {
    return getPrisma();
  }

  async beginRun(trigger: string, providers: string[]) {
    const run = await this.db.syncRun.create({ data: { trigger, providers } });
    return run.id;
  }

  async reset() {
    // Dependency order; provenance tables are kept.
    await this.db.matchEvent.deleteMany();
    await this.db.lineup.deleteMany();
    await this.db.match.deleteMany();
    await this.db.player.deleteMany();
    await this.db.teamCompetition.deleteMany();
    await this.db.team.deleteMany();
    await this.db.competition.deleteMany();
  }

  async seed(competition: Competition, teams: ProviderTeam[]) {
    const { zones, ...comp } = competition;
    await this.db.competition.upsert({
      where: { id: competition.id },
      create: { ...comp, zones: zones as object[] },
      update: { ...comp, zones: zones as object[] },
    });
    let players = 0;
    for (const t of teams) {
      const data = {
        slug: t.id,
        name: t.name,
        shortName: t.shortName,
        code: t.code,
        country: t.country,
        countryCode: t.countryCode,
        city: t.city,
        stadium: t.stadium,
        founded: t.founded,
        colors: t.colors ? [...t.colors] : ["#555555", "#ffffff"],
        manager: t.manager ?? null,
        ...(competition.kind === "league" ? { leagueId: competition.id } : {}),
      };
      await this.db.team.upsert({
        where: { id: t.id },
        create: { id: t.id, ...data },
        update: data,
      });
      await this.db.teamCompetition.upsert({
        where: {
          teamId_competitionId_season: {
            teamId: t.id,
            competitionId: competition.id,
            season: competition.season,
          },
        },
        create: { teamId: t.id, competitionId: competition.id, season: competition.season },
        update: {},
      });
      for (const p of t.squad ?? []) {
        const id = `fd-${p.externalId}`;
        const base = slugify(p.name) || id;
        const clash = await this.db.player.findUnique({
          where: { slug: base },
          select: { id: true },
        });
        const slug = clash && clash.id !== id ? `${base}-${p.externalId}` : base;
        const pdata = {
          slug,
          name: p.name,
          firstName: p.firstName,
          lastName: p.lastName,
          teamId: t.id,
          position: p.position,
          shirtNumber: p.shirtNumber,
          nationality: p.nationality,
          nationalityCode: p.nationalityCode,
          dateOfBirth: new Date(p.dateOfBirth),
          heightCm: p.heightCm ?? null,
          preferredFoot: p.preferredFoot ?? null,
        };
        await this.db.player.upsert({ where: { id }, create: { id, ...pdata }, update: pdata });
        players++;
      }
    }
    return { teams: teams.length, players };
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
