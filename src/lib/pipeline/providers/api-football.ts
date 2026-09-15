import type {
  Competition,
  EventType,
  MatchEvent,
  MatchStatus,
  Position,
  TeamLineup,
} from "../../types";
import { COMPETITION_CODES, resolveTeamId } from "../normalize";
import { matchKey } from "../reconcile";
import type {
  DetailStore,
  FetchWindow,
  MatchNeedingDetail,
  PlayerResolver,
  Provider,
  ProviderMatch,
  ProviderRecord,
  ProviderSquadPlayer,
  ProviderTeam,
} from "../types";
import { slugify } from "../../slug";

/**
 * API-Football v3 — https://www.api-football.com/documentation-v3
 *
 * The second source. It brings what football-data's free tier lacks: goal
 * scorers and assists, cards and substitutions, line-ups, the live minute, and
 * the Europa League. The free plan allows ~100 requests a day and no batching,
 * so this adapter is frugal:
 *   - the store tells it which of our matches are near kick-off, live or just
 *     finished, and which already have line-ups or events;
 *   - one `fixtures?live=all` request covers every in-play match (minute, score,
 *     events) in a single call;
 *   - line-ups and final events are fetched once per match, then never again;
 *   - the provider's fixture ids are remembered so day listings are rare;
 *   - it reads the remaining-quota header and keeps a reserve.
 */
const BASE = "https://v3.football.api-sports.io";
export const DETAILS_BEFORE_MIN = 70; // line-ups are published ~1h before kick-off
export const DETAILS_AFTER_MIN = 240; // keep refreshing a match for 4h after kick-off

interface AFTeamRef {
  id: number;
  name: string;
  logo?: string;
}
interface AFFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null; extra?: number | null };
    venue: { name: string | null };
    referee: string | null;
  };
  league: { id: number; round: string; season: number };
  teams: { home: AFTeamRef; away: AFTeamRef };
  goals: { home: number | null; away: number | null };
  score: { halftime: { home: number | null; away: number | null } };
  events?: AFEvent[];
  lineups?: AFLineup[];
}
interface AFEvent {
  time: { elapsed: number; extra: number | null };
  team: AFTeamRef;
  player: { id: number | null; name: string | null };
  assist: { id: number | null; name: string | null };
  type: "Goal" | "Card" | "subst" | "Var";
  detail: string;
}
interface AFLineupPlayer {
  player: {
    id: number;
    name: string;
    number: number;
    pos: "G" | "D" | "M" | "F" | null;
    grid: string | null;
  };
}
interface AFLineup {
  team: AFTeamRef;
  formation: string | null;
  startXI: AFLineupPlayer[];
  substitutes: AFLineupPlayer[];
  coach: { name: string | null } | null;
}
interface AFTeamEntry {
  team: {
    id: number;
    name: string;
    code: string | null;
    country: string;
    founded: number | null;
    logo: string;
  };
  venue: { name: string | null; city: string | null };
}
interface AFSquadPlayer {
  id: number;
  name: string;
  age: number | null;
  number: number | null;
  position: string | null;
}

const STATUS: Record<string, [MatchStatus, ProviderMatch["phase"]]> = {
  TBD: ["scheduled", "NS"],
  NS: ["scheduled", "NS"],
  "1H": ["live", "1H"],
  HT: ["live", "HT"],
  "2H": ["live", "2H"],
  ET: ["live", "ET"],
  BT: ["live", "ET"],
  P: ["live", "PEN"],
  SUSP: ["postponed", "NS"],
  INT: ["live", "2H"],
  FT: ["finished", "FT"],
  AET: ["finished", "ET"],
  PEN: ["finished", "PEN"],
  PST: ["postponed", "NS"],
  CANC: ["cancelled", "NS"],
  ABD: ["postponed", "NS"],
  AWD: ["finished", "FT"],
  WO: ["finished", "FT"],
  LIVE: ["live", "2H"],
};

const POS: Record<string, Position> = { G: "GK", D: "DF", M: "MF", F: "FW" };

/**
 * API-Football substitution events: `player` is the player coming ON and
 * `assist` the player going OFF. If a live match shows the arrows the wrong
 * way round, flip this flag.
 */
const SUBST_PLAYER_IS_IN = true;

export interface ApiFootballOptions {
  apiKey: string;
  /** Season start year, e.g. 2026 for 2026/27. */
  season: number;
  knownTeams: { id: string; name: string; shortName: string }[];
  /** Maps provider players to ours (creating them when needed). */
  resolvePlayer: PlayerResolver;
  /** Where to learn which matches need detail and to remember fixture ids. */
  detailStore: DetailStore;
  /** Competitions this provider is the only source for (fetch their whole season). */
  primaryFor?: string[];
  /** Whether to spend requests on match details this run. */
  detailsEnabled?: boolean;
  /** Requests left for the day that must not be spent. */
  reserve?: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  onUnknownTeam?: (name: string, externalId: string) => void;
  log?: (line: string) => void;
}

export class ApiFootballProvider implements Provider {
  readonly id = "api-football";
  readonly weight = 0.8;
  private fetchImpl: typeof fetch;
  private now: () => Date;
  private log: (line: string) => void;
  /** Daily requests remaining as reported by the last response; unknown until the first call. */
  remaining: number | null = null;
  requestsMade = 0;
  private disabledReason: string | null = null;
  private dayCache = new Map<string, AFFixture[]>();
  private seasonCache = new Map<number, AFFixture[]>();
  private liveCache: AFFixture[] | null = null;
  private needing: MatchNeedingDetail[] | null = null;

  constructor(private readonly opts: ApiFootballOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? (() => new Date());
    this.log = opts.log ?? (() => {});
  }

  supports(competitionId: string): boolean {
    return Boolean(COMPETITION_CODES[competitionId]?.apiFootball);
  }

  private canSpend(): boolean {
    if (this.disabledReason) return false;
    const reserve = this.opts.reserve ?? 5;
    return this.remaining === null || this.remaining > reserve;
  }

  private async get<T>(path: string): Promise<T> {
    if (this.disabledReason) throw new Error(`api-football disabled: ${this.disabledReason}`);
    if (!this.canSpend())
      throw new Error(
        `api-football daily budget exhausted (${this.remaining} left, keeping a reserve)`,
      );
    const res = await this.fetchImpl(`${BASE}${path}`, {
      headers: { "x-apisports-key": this.opts.apiKey },
    });
    this.requestsMade++;
    const rem = res.headers.get("x-ratelimit-requests-remaining");
    if (rem != null && rem !== "") this.remaining = Number(rem);
    if (res.status === 429) {
      this.disabledReason = "rate limited";
      throw new Error("api-football 429: rate limited");
    }
    if (!res.ok) throw new Error(`api-football ${res.status} for ${path}`);
    const body = (await res.json()) as { response: T; errors?: unknown };
    const errors = body.errors;
    if (errors && typeof errors === "object" && Object.keys(errors as object).length) {
      const text = JSON.stringify(errors);
      // A bad key or an exhausted quota will not change this run; a feature not in the plan is per-endpoint.
      if (/token|requests|subscription/i.test(text)) this.disabledReason = text;
      throw new Error(`api-football: ${text}`);
    }
    return body.response;
  }

  private teamId(t: AFTeamRef): string | null {
    const id = resolveTeamId(t.name, this.opts.knownTeams);
    if (!id) this.opts.onUnknownTeam?.(t.name, String(t.id));
    return id;
  }

  // ---- raw fetches (each cached for the run) ---------------------------------

  private async fixturesOn(day: string): Promise<AFFixture[]> {
    const cached = this.dayCache.get(day);
    if (cached) return cached;
    const list = await this.get<AFFixture[]>(`/fixtures?date=${day}&timezone=UTC`);
    this.dayCache.set(day, list);
    return list;
  }

  private async fixturesForSeason(league: number): Promise<AFFixture[]> {
    const cached = this.seasonCache.get(league);
    if (cached) return cached;
    const list = await this.get<AFFixture[]>(
      `/fixtures?league=${league}&season=${this.opts.season}&timezone=UTC`,
    );
    this.seasonCache.set(league, list);
    return list;
  }

  private async liveFixtures(): Promise<AFFixture[]> {
    if (this.liveCache) return this.liveCache;
    this.liveCache = await this.get<AFFixture[]>("/fixtures?live=all&timezone=UTC");
    return this.liveCache;
  }

  private async needingDetail(): Promise<MatchNeedingDetail[]> {
    if (!this.needing) {
      this.needing = await this.opts.detailStore.matchesNeedingDetail(
        this.id,
        this.now(),
        DETAILS_BEFORE_MIN,
        DETAILS_AFTER_MIN,
      );
    }
    return this.needing;
  }

  // ---- public ------------------------------------------------------------------

  async fetchMatches(
    competition: Competition,
    window: FetchWindow,
  ): Promise<ProviderRecord<ProviderMatch>[]> {
    const league = COMPETITION_CODES[competition.id]?.apiFootball;
    if (!league || this.disabledReason) return [];
    const out: ProviderRecord<ProviderMatch>[] = [];

    // 1. Whole season when we are the only source (e.g. Europa League).
    if (this.opts.primaryFor?.includes(competition.id)) {
      const season = (await this.fixturesForSeason(league)).filter((f) => {
        const day = f.fixture.date.slice(0, 10);
        return day >= window.fromDate && day <= window.toDate;
      });
      for (const f of season) {
        const rec = this.toRecord(competition, f);
        if (rec) out.push(rec);
      }
    }

    // 2. Detail for matches around now.
    if (this.opts.detailsEnabled) {
      try {
        out.push(...(await this.detailRecords(competition, league)));
      } catch (e) {
        this.log(
          `${competition.shortName}: api-football details failed: ${String(e instanceof Error ? e.message : e)}`,
        );
      }
    }
    return out;
  }

  /**
   * For each of our matches near kick-off: learn its fixture id (one day
   * listing, remembered), then live minute+events from the shared live call,
   * line-ups once, and final events once.
   */
  private async detailRecords(
    competition: Competition,
    league: number,
  ): Promise<ProviderRecord<ProviderMatch>[]> {
    const mine = (await this.needingDetail()).filter((m) => m.competitionId === competition.id);
    if (mine.length === 0) return [];
    const now = this.now();

    // Fixture ids: from the store, else from that day's listing.
    const ids = new Map<string, number>();
    for (const m of mine) if (m.externalId) ids.set(m.id, Number(m.externalId));
    const missing = mine.filter((m) => !ids.has(m.id));
    for (const day of new Set(missing.map((m) => m.kickoff.slice(0, 10)))) {
      if (!this.canSpend()) break;
      for (const f of (await this.fixturesOn(day)).filter((f) => f.league.id === league)) {
        const home = this.teamId(f.teams.home);
        const away = this.teamId(f.teams.away);
        if (!home || !away) continue;
        const key = matchKey({
          competitionId: competition.id,
          kickoff: new Date(f.fixture.date).toISOString(),
          homeTeamId: home,
          awayTeamId: away,
        });
        const m = missing.find((x) => x.id === key);
        if (m) {
          ids.set(m.id, f.fixture.id);
          await this.opts.detailStore.saveMatchAlias(this.id, m.id, String(f.fixture.id));
        }
      }
    }

    const records = new Map<string, ProviderRecord<ProviderMatch>>();
    const partialFor = (m: MatchNeedingDetail): ProviderMatch => ({
      id: m.id,
      competitionId: m.competitionId,
      round: 0,
      kickoff: m.kickoff,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      status: m.status,
      score: null,
      halfTimeScore: null,
      partial: true,
    });

    // Live: one call for everything in play, with minute, score and events.
    const maybeLive = mine.filter((m) => {
      const mins = (now.getTime() - new Date(m.kickoff).getTime()) / 60_000;
      return m.status === "live" || (mins >= -5 && mins <= 150 && m.status !== "finished");
    });
    if (maybeLive.length && this.canSpend()) {
      const live = await this.liveFixtures();
      for (const m of maybeLive) {
        const fid = ids.get(m.id);
        const f = live.find(
          (x) =>
            x.league.id === league &&
            (fid ? x.fixture.id === fid : this.matchesKey(competition, x, m.id)),
        );
        if (!f) continue;
        if (!fid) {
          ids.set(m.id, f.fixture.id);
          await this.opts.detailStore.saveMatchAlias(this.id, m.id, String(f.fixture.id));
        }
        const rec = this.toRecord(competition, f);
        if (!rec) continue;
        if (f.events) rec.value.events = await this.mapEvents(f, m.id, m.homeTeamId, m.awayTeamId);
        records.set(m.id, rec);
      }
    }

    for (const m of mine) {
      const fid = ids.get(m.id);
      if (!fid) continue;
      const mins = (now.getTime() - new Date(m.kickoff).getTime()) / 60_000;
      const rec = records.get(m.id) ?? {
        provider: this.id,
        externalId: String(fid),
        value: partialFor(m),
      };

      // Line-ups: once, from an hour before kick-off.
      if (!m.hasLineups && mins >= -DETAILS_BEFORE_MIN && this.canSpend()) {
        try {
          const lineups = await this.get<AFLineup[]>(`/fixtures/lineups?fixture=${fid}`);
          if (lineups.length === 2) {
            rec.value.lineups = await this.mapLineups(
              lineups,
              { home: m.homeTeamId, away: m.awayTeamId },
              this.teamId.bind(this),
            );
          }
        } catch (e) {
          this.log(
            `${competition.shortName}: line-ups for ${m.id} failed: ${String(e instanceof Error ? e.message : e)}`,
          );
        }
      }
      // Final events: once, after the match is over and the live feed no longer covers it.
      if (!rec.value.events && m.status === "finished" && !m.hasEvents && this.canSpend()) {
        try {
          const f: AFFixture = {
            ...(await this.fixtureShell(m, fid)),
            events: await this.get<AFEvent[]>(`/fixtures/events?fixture=${fid}`),
          };
          rec.value.events = await this.mapEvents(f, m.id, m.homeTeamId, m.awayTeamId);
        } catch (e) {
          this.log(
            `${competition.shortName}: events for ${m.id} failed: ${String(e instanceof Error ? e.message : e)}`,
          );
        }
      }
      if (rec.value.events || rec.value.lineups || !rec.value.partial) records.set(m.id, rec);
    }
    return [...records.values()];
  }

  private matchesKey(competition: Competition, f: AFFixture, key: string): boolean {
    const home = this.teamId(f.teams.home);
    const away = this.teamId(f.teams.away);
    if (!home || !away) return false;
    return (
      matchKey({
        competitionId: competition.id,
        kickoff: new Date(f.fixture.date).toISOString(),
        homeTeamId: home,
        awayTeamId: away,
      }) === key
    );
  }

  /** Minimal fixture object so event mapping can tell home from away without another request. */
  private async fixtureShell(m: MatchNeedingDetail, fid: number): Promise<AFFixture> {
    const day = m.kickoff.slice(0, 10);
    const cached = this.dayCache.get(day)?.find((f) => f.fixture.id === fid);
    if (cached) return cached;
    return {
      fixture: {
        id: fid,
        date: m.kickoff,
        status: { short: "FT", elapsed: null },
        venue: { name: null },
        referee: null,
      },
      league: { id: 0, round: "", season: this.opts.season },
      teams: { home: { id: -1, name: m.homeTeamId }, away: { id: -2, name: m.awayTeamId } },
      goals: { home: null, away: null },
      score: { halftime: { home: null, away: null } },
    };
  }

  private toRecord(competition: Competition, f: AFFixture): ProviderRecord<ProviderMatch> | null {
    const home = this.teamId(f.teams.home);
    const away = this.teamId(f.teams.away);
    if (!home || !away) return null;
    const [status, phase] = STATUS[f.fixture.status.short] ?? ["scheduled", "NS"];
    const round = Number(/(\d+)\s*$/.exec(f.league.round)?.[1] ?? 0);
    const kickoff = new Date(f.fixture.date).toISOString();
    return {
      provider: this.id,
      externalId: String(f.fixture.id),
      value: {
        id: "",
        competitionId: competition.id,
        round,
        stage: competition.kind === "cup" ? humanStage(f.league.round) : undefined,
        kickoff,
        homeTeamId: home,
        awayTeamId: away,
        status,
        phase,
        minute: status === "live" ? f.fixture.status.elapsed : null,
        score:
          f.goals.home != null && f.goals.away != null
            ? { home: f.goals.home, away: f.goals.away }
            : null,
        halfTimeScore:
          f.score.halftime.home != null && f.score.halftime.away != null
            ? { home: f.score.halftime.home, away: f.score.halftime.away }
            : null,
        venue: f.fixture.venue.name ?? undefined,
        referee: f.fixture.referee ?? undefined,
      },
    };
  }

  private async mapEvents(
    f: AFFixture,
    matchId: string,
    home: string,
    away: string,
  ): Promise<MatchEvent[]> {
    const events: MatchEvent[] = [];
    for (const e of f.events ?? []) {
      // Events carry the provider's team id; fall back to name resolution for shells.
      const teamId =
        e.team.id === f.teams.home.id
          ? home
          : e.team.id === f.teams.away.id
            ? away
            : (this.teamId(e.team) ?? home);
      const type = eventType(e);
      if (!type) continue;
      let playerId: string | null = null;
      let relatedPlayerId: string | null = null;
      const main =
        e.player.id && e.player.name
          ? { externalId: String(e.player.id), name: e.player.name }
          : null;
      const other =
        e.assist.id && e.assist.name
          ? { externalId: String(e.assist.id), name: e.assist.name }
          : null;
      if (type === "substitution") {
        const on = SUBST_PLAYER_IS_IN ? main : other;
        const off = SUBST_PLAYER_IS_IN ? other : main;
        playerId = off ? await this.opts.resolvePlayer(teamId, off) : null;
        relatedPlayerId = on ? await this.opts.resolvePlayer(teamId, on) : null;
      } else {
        // An own goal is credited to a player of the *other* team.
        const scorerTeam = type === "own_goal" ? (teamId === home ? away : home) : teamId;
        playerId = main ? await this.opts.resolvePlayer(scorerTeam, main) : null;
        relatedPlayerId =
          other && type === "goal" ? await this.opts.resolvePlayer(teamId, other) : null;
      }
      events.push({
        id: "",
        matchId,
        minute: e.time.elapsed,
        addedTime: e.time.extra ?? undefined,
        teamId,
        type,
        playerId,
        relatedPlayerId,
        detail: e.detail,
      });
    }
    return events.sort((a, b) => a.minute - b.minute || (a.addedTime ?? 0) - (b.addedTime ?? 0));
  }

  private async mapLineups(
    lineups: AFLineup[],
    ours: { home: string; away: string },
    resolve: (t: AFTeamRef) => string | null,
  ): Promise<{ home: TeamLineup; away: TeamLineup }> {
    const build = async (l: AFLineup, teamId: string): Promise<TeamLineup> => {
      const toPlayer = async (p: AFLineupPlayer, i: number, starting: boolean) => {
        const position = POS[p.player.pos ?? ""] ?? "MF";
        const playerId = await this.opts.resolvePlayer(teamId, {
          externalId: String(p.player.id),
          name: p.player.name,
          shirtNumber: p.player.number,
          position,
        });
        return {
          playerId,
          shirtNumber: p.player.number,
          position,
          grid: p.player.grid ?? (starting ? `${i === 0 ? 1 : 2}:${i || 1}` : ""),
        };
      };
      const starting = [];
      for (const [i, p] of l.startXI.entries()) starting.push(await toPlayer(p, i, true));
      const bench = [];
      for (const [i, p] of l.substitutes.entries()) bench.push(await toPlayer(p, i, false));
      return {
        teamId,
        formation: l.formation ?? "",
        starting,
        bench,
        coach: l.coach?.name ?? undefined,
      };
    };
    const [a, b] = lineups;
    const aIsHome = resolve(a.team) === ours.home;
    const homeL = aIsHome ? a : b;
    const awayL = aIsHome ? b : a;
    return { home: await build(homeL, ours.home), away: await build(awayL, ours.away) };
  }

  // ---- teams & squads (used when this is the only source, e.g. Europa League) ----

  async fetchTeams(competition: Competition): Promise<ProviderRecord<ProviderTeam>[]> {
    const league = COMPETITION_CODES[competition.id]?.apiFootball;
    if (!league || !(this.opts.primaryFor?.includes(competition.id) ?? false)) return [];
    const entries = await this.get<AFTeamEntry[]>(
      `/teams?league=${league}&season=${this.opts.season}`,
    );
    return entries.map(({ team, venue }) => {
      const known = resolveTeamId(team.name, this.opts.knownTeams);
      const id = known ?? slugify(team.name);
      if (!known) this.opts.knownTeams.push({ id, name: team.name, shortName: team.name });
      return {
        provider: this.id,
        externalId: String(team.id),
        value: {
          id,
          isNew: !known,
          name: team.name,
          shortName: team.name,
          code: (team.code ?? team.name.slice(0, 3)).toUpperCase(),
          country: team.country,
          countryCode: team.country,
          city: venue.city ?? "",
          stadium: venue.name ?? "",
          founded: team.founded ?? 0,
          manager: undefined,
          crestUrl: team.logo,
          squad: [],
        },
      };
    });
  }

  async fetchSquad(teamExternalId: string): Promise<ProviderRecord<ProviderSquadPlayer>[]> {
    const res = await this.get<{ players: AFSquadPlayer[] }[]>(
      `/players/squads?team=${teamExternalId}`,
    );
    const players = res[0]?.players ?? [];
    const year = this.now().getUTCFullYear();
    return players.map((p) => {
      const parts = p.name.trim().split(/\s+/);
      return {
        provider: this.id,
        externalId: `af-${p.id}`,
        value: {
          externalId: `af-${p.id}`,
          name: p.name,
          firstName: parts[0],
          lastName: parts.slice(1).join(" ") || parts[0],
          position: squadPosition(p.position),
          shirtNumber: p.number ?? 0,
          nationality: "",
          nationalityCode: "",
          dateOfBirth: p.age ? `${year - p.age}-01-01` : "1900-01-01",
        },
      };
    });
  }
}

function eventType(e: AFEvent): EventType | null {
  const d = e.detail.toLowerCase();
  switch (e.type) {
    case "Goal":
      if (d.includes("own")) return "own_goal";
      if (d.includes("missed")) return "missed_penalty";
      if (d.includes("penalty")) return "penalty";
      return "goal";
    case "Card":
      if (d.includes("second")) return "second_yellow";
      if (d.includes("red")) return "red";
      return "yellow";
    case "subst":
      return "substitution";
    case "Var":
      return "var";
    default:
      return null;
  }
}

function squadPosition(p: string | null): Position {
  const s = (p ?? "").toLowerCase();
  if (s.startsWith("goal")) return "GK";
  if (s.startsWith("def")) return "DF";
  if (s.startsWith("mid")) return "MF";
  if (s.startsWith("att")) return "FW";
  return "MF";
}

function humanStage(round: string): string {
  return round.replace(/\s*-\s*\d+$/, "");
}
