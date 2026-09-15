import { getPrisma } from "../db";
import type { Competition } from "../types";
import type { ReconciledMatch } from "./reconcile";
import type { SyncStore } from "./store";
import { matchSlug } from "../match-slug";
import { slugify } from "../slug";
import { matchPlayer, type SquadEntry } from "./players";
import type {
  Conflict,
  MatchNeedingDetail,
  PlayerResolver,
  ProviderTeam,
  Resolution,
} from "./types";

export class PrismaSyncStore implements SyncStore {
  private get db() {
    return getPrisma();
  }

  async beginRun(trigger: string, providers: string[], mode = "full") {
    const run = await this.db.syncRun.create({ data: { trigger, providers, mode } });
    return run.id;
  }

  async isSyncRunning(withinSeconds: number) {
    const n = await this.db.syncRun.count({
      where: { finishedAt: null, startedAt: { gte: new Date(Date.now() - withinSeconds * 1000) } },
    });
    return n > 0;
  }

  async minutesSinceLastDetailRun() {
    const last = await this.db.syncRun.findFirst({
      where: { detailRequests: { gt: 0 } },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    });
    return last ? (Date.now() - last.startedAt.getTime()) / 60_000 : null;
  }

  async hasMatchesAround(now: Date, beforeMin: number, afterMin: number) {
    const n = await this.db.match.count({
      where: {
        kickoff: {
          gte: new Date(now.getTime() - afterMin * 60_000),
          lte: new Date(now.getTime() + beforeMin * 60_000),
        },
        status: { notIn: ["postponed", "cancelled"] },
      },
    });
    return n > 0;
  }

  async matchesNeedingDetail(
    provider: string,
    now: Date,
    beforeMin: number,
    afterMin: number,
  ): Promise<MatchNeedingDetail[]> {
    const rows = await this.db.match.findMany({
      where: {
        kickoff: {
          gte: new Date(now.getTime() - afterMin * 60_000),
          lte: new Date(now.getTime() + beforeMin * 60_000),
        },
        status: { notIn: ["postponed", "cancelled"] },
      },
      include: { _count: { select: { events: true, lineups: true } } },
    });
    if (rows.length === 0) return [];
    const aliases = await this.db.entityAlias.findMany({
      where: { provider, entityType: "match", entityId: { in: rows.map((r) => r.id) } },
    });
    const byMatch = new Map(aliases.map((a) => [a.entityId, a.externalId]));
    return rows.map((r) => ({
      id: r.id,
      competitionId: r.competitionId,
      kickoff: r.kickoff.toISOString(),
      homeTeamId: r.homeTeamId,
      awayTeamId: r.awayTeamId,
      status: r.status as MatchNeedingDetail["status"],
      hasLineups: r._count.lineups >= 2,
      hasEvents: r._count.events > 0,
      externalId: byMatch.get(r.id) ?? null,
    }));
  }

  async saveMatchAlias(provider: string, matchId: string, externalId: string) {
    await this.db.entityAlias.upsert({
      where: { provider_entityType_externalId: { provider, entityType: "match", externalId } },
      create: {
        provider,
        entityType: "match",
        externalId,
        externalName: matchId,
        entityId: matchId,
        source: "matched",
      },
      update: { entityId: matchId },
    });
  }

  /**
   * Resolves provider players against the team's squad in the database. A
   * player nobody recognises is created (id "af-<externalId>") so events and
   * line-ups can reference them; the alias is remembered for next time.
   */
  playerResolver(): PlayerResolver {
    const squads = new Map<string, SquadEntry[]>();
    const aliases = new Map<string, string>();
    const loadSquad = async (teamId: string) => {
      let s = squads.get(teamId);
      if (!s) {
        s = (
          await this.db.player.findMany({
            where: { teamId },
            select: { id: true, name: true, shirtNumber: true },
          })
        ).map((p) => ({
          id: p.id,
          name: p.name,
          shirtNumber: p.shirtNumber,
        }));
        squads.set(teamId, s);
      }
      return s;
    };
    return async (teamId, ref) => {
      const key = `${ref.externalId}`;
      const cached = aliases.get(key);
      if (cached) return cached;
      const stored = await this.db.entityAlias.findUnique({
        where: {
          provider_entityType_externalId: {
            provider: "api-football",
            entityType: "player",
            externalId: ref.externalId,
          },
        },
      });
      if (stored) {
        aliases.set(key, stored.entityId);
        return stored.entityId;
      }
      const squad = await loadSquad(teamId);
      let id = matchPlayer(ref, squad);
      if (!id) {
        id = `af-${ref.externalId}`;
        const parts = ref.name.trim().split(/\s+/);
        const base = slugify(ref.name) || id;
        const clash = await this.db.player.findUnique({
          where: { slug: base },
          select: { id: true },
        });
        const slug = clash && clash.id !== id ? `${base}-${ref.externalId}` : base;
        await this.db.player.upsert({
          where: { id },
          create: {
            id,
            slug,
            name: ref.name,
            firstName: parts[0],
            lastName: parts.slice(1).join(" ") || parts[0],
            teamId,
            position: ref.position ?? "MF",
            shirtNumber: ref.shirtNumber ?? 0,
            nationality: "",
            nationalityCode: "",
            dateOfBirth: new Date("1900-01-01"),
          },
          update: { teamId, ...(ref.shirtNumber ? { shirtNumber: ref.shirtNumber } : {}) },
        });
        squad.push({ id, name: ref.name, shirtNumber: ref.shirtNumber ?? undefined });
      }
      await this.db.entityAlias.upsert({
        where: {
          provider_entityType_externalId: {
            provider: "api-football",
            entityType: "player",
            externalId: ref.externalId,
          },
        },
        create: {
          provider: "api-football",
          entityType: "player",
          externalId: ref.externalId,
          externalName: ref.name,
          entityId: id,
          source: id.startsWith("af-") ? "created" : "matched",
        },
        update: { entityId: id, externalName: ref.name },
      });
      aliases.set(key, id);
      return id;
    };
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
        crestUrl: t.crestUrl ?? null,
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
        slug: matchSlug({ homeTeamId: v.homeTeamId, awayTeamId: v.awayTeamId, kickoff: v.kickoff }),
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
        disputed: m.disputedFields.length > 0,
        disputedFields: m.disputedFields,
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
      if (v.lineups) {
        for (const side of [v.lineups.home, v.lineups.away]) {
          const data = {
            formation: side.formation,
            starting: side.starting as unknown as object[],
            bench: side.bench as unknown as object[],
            coach: side.coach ?? null,
          };
          await this.db.lineup.upsert({
            where: { matchId_teamId: { matchId: m.id, teamId: side.teamId } },
            create: { matchId: m.id, teamId: side.teamId, ...data },
            update: data,
          });
        }
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
      providerRequests?: Record<string, number>;
      error?: string;
    },
  ) {
    const { providerRequests, ...counts } = stats;
    await this.db.syncRun.update({
      where: { id: runId },
      data: {
        finishedAt: new Date(),
        ...counts,
        detailRequests: providerRequests?.["api-football"] ?? 0,
      },
    });
  }
}
