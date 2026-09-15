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
  FetchWindow,
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
 * the Europa League. The free plan allows ~100 requests a day, so this adapter
 * is frugal:
 *   - one request per day fetches every fixture of that day across all leagues;
 *   - details (events + line-ups) come in batches of up to 20 fixtures per request,
 *     only for matches that are live, recently finished, or about to start;
 *   - a reserve is kept so the daily quota is never fully spent by one run.
 */
const BASE = "https://v3.football.api-sports.io";
const DETAILS_BATCH = 20;
const DETAILS_BEFORE_MIN = 70; // line-ups are published ~1h before kick-off
const DETAILS_AFTER_MIN = 240; // keep refreshing a match for 4h after kick-off

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
 * `assist` the player going OFF. Verified against the documentation examples;
 * if a live match shows arrows the wrong way round, flip this flag.
 */
const SUBST_PLAYER_IS_IN = true;

export interface ApiFootballOptions {
  apiKey: string;
  /** Season start year, e.g. 2026 for 2026/27. */
  season: number;
  knownTeams: { id: string; name: string; shortName: string }[];
  /** Maps provider players to ours (creating them when needed). Required for events and line-ups. */
  resolvePlayer: PlayerResolver;
  /** Competitions this provider is the only source for (fetch their whole season). */
  primaryFor?: string[];
  /** Whether to spend requests on match details this run (line-ups, events, live minute). */
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
  private detailCache = new Map<number, AFFixture>();

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
    const body = (await res.json()) as { response: T; errors?: unknown; message?: string };
    const errors = body.errors;
    if (errors && typeof errors === "object" && Object.keys(errors as object).length) {
      const text = JSON.stringify(errors);
      // Plan/token errors will not go away this run.
      if (/plan|token|subscription|access/i.test(text)) this.disabledReason = text;
      throw new Error(`api-football: ${text}`);
    }
    return body.response;
  }

  private teamId(t: AFTeamRef): string | null {
    const id = resolveTeamId(t.name, this.opts.knownTeams);
    if (!id) this.opts.onUnknownTeam?.(t.name, String(t.id));
    return id;
  }

  // ---- fixtures ----------------------------------------------------------

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

  private needsDetails(f: AFFixture): boolean {
    const [status] = STATUS[f.fixture.status.short] ?? ["scheduled"];
    if (status === "postponed" || status === "cancelled") return false;
    const minutes = (this.now().getTime() - new Date(f.fixture.date).getTime()) / 60_000;
    return minutes >= -DETAILS_BEFORE_MIN && minutes <= DETAILS_AFTER_MIN;
  }

  private async loadDetails(fixtures: AFFixture[]): Promise<void> {
    const wanted = fixtures.filter(
      (f) => this.needsDetails(f) && !this.detailCache.has(f.fixture.id),
    );
    for (let i = 0; i < wanted.length; i += DETAILS_BATCH) {
      if (!this.canSpend()) {
        this.log(
          `api-football: skipping details for ${wanted.length - i} matches to protect the daily budget`,
        );
        break;
      }
      const batch = wanted.slice(i, i + DETAILS_BATCH);
      const detailed = await this.get<AFFixture[]>(
        `/fixtures?ids=${batch.map((f) => f.fixture.id).join("-")}&timezone=UTC`,
      );
      for (const d of detailed) this.detailCache.set(d.fixture.id, d);
    }
  }

  async fetchMatches(
    competition: Competition,
    window: FetchWindow,
  ): Promise<ProviderRecord<ProviderMatch>[]> {
    const league = COMPETITION_CODES[competition.id]?.apiFootball;
    if (!league || this.disabledReason) return [];
    const primary = this.opts.primaryFor?.includes(competition.id) ?? false;

    let fixtures: AFFixture[];
    if (primary) {
      // Only source for this competition: the whole season, then details for today's matches.
      fixtures = (await this.fixturesForSeason(league)).filter((f) => {
        const day = f.fixture.date.slice(0, 10);
        return day >= window.fromDate && day <= window.toDate;
      });
    } else {
      // Cross-check and detail source: only the days around now.
      const today = this.now().toISOString().slice(0, 10);
      const days = [-1, 0, 1]
        .map((d) => new Date(Date.parse(today) + d * 86_400_000).toISOString().slice(0, 10))
        .filter((d) => d >= window.fromDate && d <= window.toDate);
      fixtures = [];
      for (const day of days) {
        // Spend a request only when something on that day is close to kick-off.
        if (!this.opts.detailsEnabled && day !== today) continue;
        if (!this.dayCache.has(day) && !this.canSpend()) {
          this.log(
            `api-football: not fetching ${day}, daily budget nearly spent (${this.remaining} left)`,
          );
          continue;
        }
        const list = await this.fixturesOn(day);
        fixtures.push(...list.filter((f) => f.league.id === league));
      }
    }

    if (this.opts.detailsEnabled) {
      try {
        await this.loadDetails(fixtures);
      } catch (e) {
        this.log(`api-football: details failed: ${String(e instanceof Error ? e.message : e)}`);
      }
    }

    const out: ProviderRecord<ProviderMatch>[] = [];
    for (const raw of fixtures) {
      const f = this.detailCache.get(raw.fixture.id) ?? raw;
      const home = this.teamId(f.teams.home);
      const away = this.teamId(f.teams.away);
      if (!home || !away) continue;
      const [status, phase] = STATUS[f.fixture.status.short] ?? ["scheduled", "NS"];
      const round = Number(/(\d+)\s*$/.exec(f.league.round)?.[1] ?? 0);
      const kickoff = new Date(f.fixture.date).toISOString();
      const base = { competitionId: competition.id, kickoff, homeTeamId: home, awayTeamId: away };
      const id = matchKey(base);
      const value: ProviderMatch = {
        id: "",
        ...base,
        round,
        stage: competition.kind === "cup" ? humanStage(f.league.round) : undefined,
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
      };
      if (f.events) value.events = await this.mapEvents(f, id, home, away);
      if (f.lineups?.length === 2) value.lineups = await this.mapLineups(f, home, away);
      out.push({ provider: this.id, externalId: String(f.fixture.id), value });
    }
    return out;
  }

  private async mapEvents(
    f: AFFixture,
    matchId: string,
    home: string,
    away: string,
  ): Promise<MatchEvent[]> {
    const events: MatchEvent[] = [];
    for (const e of f.events ?? []) {
      const teamId = e.team.id === f.teams.home.id ? home : away;
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
    f: AFFixture,
    home: string,
    away: string,
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
    const [a, b] = f.lineups!;
    const homeL = a.team.id === f.teams.home.id ? a : b;
    const awayL = homeL === a ? b : a;
    return { home: await build(homeL, home), away: await build(awayL, away) };
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
