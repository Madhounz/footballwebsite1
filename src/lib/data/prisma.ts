import type { ISODate } from "../dates";
import type {
  Competition,
  DataSourceInfo,
  Honours,
  LineupPlayer,
  Lineups,
  Match,
  MatchEvent,
  MatchView,
  Player,
  Position,
  ScorerRow,
  SearchItem,
  Standings,
  TableZone,
  Team,
} from "../types";
import { getPrisma } from "../db";
import type {
  Competition as DbCompetition,
  Match as DbMatch,
  MatchEvent as DbEvent,
  Player as DbPlayer,
  Team as DbTeam,
} from "@/generated/prisma/client";
import { honoursFor, allHonours } from "./honours";
import { byMostRecent, playerMatchFrom } from "./player-matches";
import type { MatchDetail, PlayerMatch, Repository, TeamHonour } from "./repository";
import { computeScorers, computeStandings } from "./standings";

/** PostgreSQL-backed repository. Filled by the sync pipeline (scripts/sync.ts). */
export class PrismaRepository implements Repository {
  private get db() {
    return getPrisma();
  }

  info(): DataSourceInfo {
    return {
      kind: "db",
      label: "Live data",
      freshness: "Updated by the sync pipeline and cross-checked across providers.",
    };
  }

  /**
   * Competitions worth showing: the ones we actually have matches for. A
   * section with nothing in it reads as a broken site rather than an honest
   * gap, and free provider plans do not cover every competition we define. A
   * competition still resolves by slug, so an existing link never breaks; it
   * simply stops being advertised until data arrives.
   */
  async listCompetitions(): Promise<Competition[]> {
    const rows = await this.db.competition.findMany({
      where: { matches: { some: {} } },
      orderBy: { order: "asc" },
    });
    return rows.map(toCompetition);
  }
  async getCompetitionBySlug(slug: string): Promise<Competition | null> {
    const row = await this.db.competition.findUnique({ where: { slug } });
    return row ? toCompetition(row) : null;
  }

  async listTeams(competitionId?: string): Promise<Team[]> {
    const rows = await this.db.team.findMany({
      where: competitionId ? { competitions: { some: { competitionId } } } : undefined,
      include: { competitions: true },
      orderBy: { name: "asc" },
    });
    return rows.map((t) =>
      toTeam(
        t,
        t.competitions.map((c) => c.competitionId),
      ),
    );
  }
  async getTeamBySlug(slug: string): Promise<Team | null> {
    const t = await this.db.team.findUnique({ where: { slug }, include: { competitions: true } });
    return t
      ? toTeam(
          t,
          t.competitions.map((c) => c.competitionId),
        )
      : null;
  }
  async getTeamById(id: string): Promise<Team | null> {
    const t = await this.db.team.findUnique({ where: { id }, include: { competitions: true } });
    return t
      ? toTeam(
          t,
          t.competitions.map((c) => c.competitionId),
        )
      : null;
  }
  async getSquad(teamId: string): Promise<Player[]> {
    const rows = await this.db.player.findMany({
      where: { teamId },
      orderBy: [{ position: "asc" }, { shirtNumber: "asc" }],
    });
    return rows
      .map(toPlayer)
      .sort(
        (a, b) => POS_ORDER[a.position] - POS_ORDER[b.position] || a.shirtNumber - b.shirtNumber,
      );
  }
  async getPlayerBySlug(slug: string): Promise<Player | null> {
    const p = await this.db.player.findUnique({ where: { slug } });
    return p ? toPlayer(p) : null;
  }

  private async views(
    rows: (DbMatch & { competition: DbCompetition; home: DbTeam; away: DbTeam })[],
  ): Promise<MatchView[]> {
    return rows.map((m) => ({
      match: toMatch(m),
      competition: toCompetition(m.competition),
      home: toTeam(m.home, []),
      away: toTeam(m.away, []),
    }));
  }
  private include = { competition: true, home: true, away: true } as const;

  async getMatchesOnDate(date: ISODate): Promise<MatchView[]> {
    const start = new Date(`${date}T00:00:00Z`);
    const end = new Date(start.getTime() + 86_400_000);
    const rows = await this.db.match.findMany({
      where: { kickoff: { gte: start, lt: end } },
      include: this.include,
      orderBy: { kickoff: "asc" },
    });
    return this.views(rows);
  }
  async getLiveMatches(): Promise<MatchView[]> {
    const rows = await this.db.match.findMany({
      where: { status: "live" },
      include: this.include,
      orderBy: { kickoff: "asc" },
    });
    return this.views(rows);
  }
  async getMatch(idOrSlug: string): Promise<MatchDetail | null> {
    const m = await this.db.match.findFirst({
      // Accepts either form, so links shared before readable slugs still resolve.
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        ...this.include,
        events: { orderBy: [{ minute: "asc" }, { addedTime: "asc" }] },
        lineups: true,
      },
    });
    if (!m) return null;
    const [view] = await this.views([m]);
    const events = m.events.map(toEvent);
    const home = m.lineups.find((l) => l.teamId === m.homeTeamId);
    const away = m.lineups.find((l) => l.teamId === m.awayTeamId);
    const lineups: Lineups | null =
      home && away
        ? {
            matchId: m.id,
            home: {
              teamId: home.teamId,
              formation: home.formation,
              starting: home.starting as unknown as LineupPlayer[],
              bench: home.bench as unknown as LineupPlayer[],
              coach: home.coach ?? undefined,
            },
            away: {
              teamId: away.teamId,
              formation: away.formation,
              starting: away.starting as unknown as LineupPlayer[],
              bench: away.bench as unknown as LineupPlayer[],
              coach: away.coach ?? undefined,
            },
          }
        : null;
    const ids = new Set<string>();
    for (const e of events) {
      if (e.playerId) ids.add(e.playerId);
      if (e.relatedPlayerId) ids.add(e.relatedPlayerId);
    }
    if (lineups)
      for (const side of [lineups.home, lineups.away])
        for (const p of [...side.starting, ...side.bench]) ids.add(p.playerId);
    const players = await this.db.player.findMany({ where: { id: { in: [...ids] } } });
    return {
      view,
      events,
      lineups,
      players: Object.fromEntries(players.map((p) => [p.id, toPlayer(p)])),
    };
  }
  async getCompetitionMatches(competitionId: string): Promise<MatchView[]> {
    const rows = await this.db.match.findMany({
      where: { competitionId },
      include: this.include,
      orderBy: { kickoff: "asc" },
    });
    return this.views(rows);
  }
  async getTeamMatches(teamId: string): Promise<MatchView[]> {
    const rows = await this.db.match.findMany({
      where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
      include: this.include,
      orderBy: { kickoff: "asc" },
    });
    return this.views(rows);
  }

  async getStandings(competitionId: string): Promise<Standings> {
    const comp = await this.db.competition.findUnique({ where: { id: competitionId } });
    if (!comp) throw new Error(`unknown competition ${competitionId}`);
    const teams = await this.listTeams(competitionId);
    const matches = await this.db.match.findMany({ where: { competitionId, season: comp.season } });
    return computeStandings(
      competitionId,
      comp.season,
      teams.map((t) => t.id),
      matches.map(toMatch),
    );
  }
  async getTopScorers(competitionId: string, limit = 20): Promise<ScorerRow[]> {
    const events = await this.db.matchEvent.findMany({
      where: {
        match: { competitionId, status: { in: ["live", "finished"] } },
        type: { in: ["goal", "penalty"] },
      },
    });
    const lineups = await this.db.lineup.findMany({
      where: { match: { competitionId, status: { in: ["live", "finished"] } } },
      select: { starting: true },
    });
    const apps = new Map<string, number>();
    for (const l of lineups)
      for (const p of l.starting as unknown as LineupPlayer[])
        apps.set(p.playerId, (apps.get(p.playerId) ?? 0) + 1);
    return computeScorers(events.map(toEvent), apps, limit);
  }
  async getPlayerSeasonStats(playerId: string): Promise<ScorerRow | null> {
    const p = await this.db.player.findUnique({ where: { id: playerId } });
    if (!p) return null;
    const events = await this.db.matchEvent.findMany({
      where: {
        OR: [{ playerId }, { relatedPlayerId: playerId }],
        type: { in: ["goal", "penalty"] },
      },
    });
    const rows = computeScorers(events.map(toEvent), new Map(), 10_000);
    const r = rows.find((x) => x.playerId === playerId) ?? {
      playerId,
      teamId: p.teamId,
      goals: 0,
      assists: 0,
      penalties: 0,
      appearances: 0,
    };
    const lineups = await this.db.lineup.findMany({
      where: { teamId: p.teamId, match: { status: { in: ["live", "finished"] } } },
      select: { starting: true, bench: true, matchId: true },
    });
    const subsOn = await this.db.matchEvent.findMany({
      where: { type: "substitution", relatedPlayerId: playerId },
      select: { matchId: true },
    });
    const on = new Set(subsOn.map((s) => s.matchId));
    r.appearances = lineups.filter(
      (l) =>
        (l.starting as unknown as LineupPlayer[]).some((x) => x.playerId === playerId) ||
        on.has(l.matchId),
    ).length;
    return r;
  }

  /**
   * Every appearance with what the player did in it. One pass over the team's
   * line-ups tells us which matches they were in; one over their own events
   * tells us what happened in them.
   */
  async getPlayerMatches(playerId: string): Promise<PlayerMatch[]> {
    const p = await this.db.player.findUnique({ where: { id: playerId } });
    if (!p) return [];
    const lineups = await this.db.lineup.findMany({
      where: { teamId: p.teamId, match: { status: { in: ["live", "finished"] } } },
      select: { matchId: true, starting: true, bench: true },
    });
    const events = await this.db.matchEvent.findMany({
      where: { OR: [{ playerId }, { relatedPlayerId: playerId }] },
    });
    const byMatch = new Map<string, MatchEvent[]>();
    for (const e of events) byMatch.set(e.matchId, [...(byMatch.get(e.matchId) ?? []), toEvent(e)]);
    // A match with no line-up on file can still be an appearance: a goal or a
    // card names the player even when nobody published the eleven.
    const ids = new Set([...lineups.map((l) => l.matchId), ...byMatch.keys()]);
    if (ids.size === 0) return [];
    const rows = await this.db.match.findMany({
      where: { id: { in: [...ids] }, status: { in: ["live", "finished"] } },
      include: this.include,
    });
    const starting = new Map(
      lineups.map((l) => [
        l.matchId,
        (l.starting as unknown as LineupPlayer[]).map((x) => x.playerId),
      ]),
    );
    const out: PlayerMatch[] = [];
    for (const view of await this.views(rows)) {
      const m = playerMatchFrom(
        playerId,
        view,
        starting.get(view.match.id) ?? [],
        byMatch.get(view.match.id) ?? [],
      );
      if (m) out.push(m);
    }
    return out.sort(byMostRecent);
  }

  async getHonours(competitionId: string): Promise<Honours | null> {
    return honoursFor(competitionId);
  }
  async getTeamHonours(teamId: string): Promise<TeamHonour[]> {
    const comps = await this.listCompetitions();
    const out: TeamHonour[] = [];
    for (const h of allHonours()) {
      const seasons = h.entries.filter((e) => e.winnerTeamId === teamId).map((e) => e.season);
      if (seasons.length)
        out.push({
          competition: comps.find((c) => c.id === h.competitionId) ?? {
            id: h.competitionId,
            name: h.name,
          },
          seasons,
        });
    }
    return out;
  }

  async listPlayers() {
    return this.db.player.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  async searchIndex(): Promise<SearchItem[]> {
    const [comps, teams] = await Promise.all([this.listCompetitions(), this.listTeams()]);
    return [
      ...comps.map<SearchItem>((c) => ({
        type: "competition",
        id: c.id,
        slug: c.slug,
        label: c.name,
        sublabel: c.country,
        href: `/leagues/${c.slug}`,
        keywords: [c.shortName, c.country],
      })),
      ...teams.map<SearchItem>((t) => ({
        type: "team",
        id: t.id,
        slug: t.slug,
        label: t.name,
        sublabel: `${t.city} · ${t.country}`,
        href: `/teams/${t.slug}`,
        keywords: [t.shortName, t.code, t.city],
      })),
    ];
  }
}

const POS_ORDER: Record<Position, number> = { GK: 0, DF: 1, MF: 2, FW: 3 };

function toCompetition(c: DbCompetition): Competition {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    shortName: c.shortName,
    country: c.country,
    countryCode: c.countryCode,
    kind: c.kind as Competition["kind"],
    order: c.order,
    season: c.season,
    teamCount: c.teamCount,
    rounds: c.rounds,
    color: c.color,
    zones: c.zones as unknown as TableZone[],
  };
}

function toTeam(t: DbTeam, competitionIds: string[]): Team {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    shortName: t.shortName,
    code: t.code,
    country: t.country,
    countryCode: t.countryCode,
    city: t.city,
    stadium: t.stadium,
    founded: t.founded,
    colors: [t.colors[0] ?? "#444444", t.colors[1] ?? "#ffffff"],
    competitionIds,
    leagueId: t.leagueId ?? undefined,
    manager: t.manager ?? undefined,
    crestUrl: t.crestUrl ?? undefined,
  };
}

function toPlayer(p: DbPlayer): Player {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    firstName: p.firstName,
    lastName: p.lastName,
    teamId: p.teamId,
    position: p.position as Position,
    shirtNumber: p.shirtNumber,
    nationality: p.nationality,
    nationalityCode: p.nationalityCode,
    dateOfBirth: p.dateOfBirth.toISOString().slice(0, 10),
    heightCm: p.heightCm ?? undefined,
    preferredFoot: (p.preferredFoot as Player["preferredFoot"]) ?? undefined,
  };
}

function toMatch(m: DbMatch): Match {
  return {
    id: m.id,
    slug: m.slug,
    competitionId: m.competitionId,
    season: m.season,
    round: m.round,
    stage: m.stage ?? undefined,
    kickoff: m.kickoff.toISOString(),
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    status: m.status as Match["status"],
    phase: m.phase as Match["phase"],
    minute: m.minute,
    score:
      m.homeScore != null && m.awayScore != null ? { home: m.homeScore, away: m.awayScore } : null,
    halfTimeScore:
      m.homeHtScore != null && m.awayHtScore != null
        ? { home: m.homeHtScore, away: m.awayHtScore }
        : null,
    venue: m.venue ?? undefined,
    attendance: m.attendance ?? undefined,
    referee: m.referee ?? undefined,
    timelineComplete: m.status === "finished" ? m.eventsFinalAt != null : undefined,
    disputed: m.disputed || undefined,
    disputedFields: m.disputedFields.length > 0 ? m.disputedFields : undefined,
  };
}

function toEvent(e: DbEvent): MatchEvent {
  return {
    id: e.id,
    matchId: e.matchId,
    minute: e.minute,
    addedTime: e.addedTime ?? undefined,
    teamId: e.teamId,
    type: e.type as MatchEvent["type"],
    playerId: e.playerId,
    relatedPlayerId: e.relatedPlayerId,
    detail: e.detail ?? undefined,
  };
}
