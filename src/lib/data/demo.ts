import { daysBetween, dateOf, todayISO, type ISODate } from "../dates";
import type {
  Competition,
  DataSourceInfo,
  Honours,
  LineupPlayer,
  Lineups,
  Match,
  MatchEvent,
  MatchPhase,
  MatchStatus,
  MatchView,
  Player,
  Position,
  ScorerChart,
  ScorerRow,
  TableSide,
  SearchItem,
  Standings,
  Team,
  TeamLineup,
} from "../types";
import type { DemoDataset, DemoLineup, DemoMatch } from "./demo-format";
import { matchSlug } from "../match-slug";
import { honoursFor, allHonours } from "./honours";
import { byMostRecent, playerMatchFrom } from "./player-matches";
import type { MatchDetail, PlayerMatch, Repository, TeamHonour } from "./repository";
import type { PlayerSeasonStats } from "./player-stats";
import { computeScorers, computeStandings } from "./standings";
import dataset from "../../../data/demo/dataset.json";
import { isLive } from "../live-status";

const DATA = dataset as unknown as DemoDataset;

const HALF = 45;
const HT_BREAK = 15;
const ADDED_1H = 2;
const ADDED_2H = 4;
const FULL_TIME_MIN = HALF + ADDED_1H + HT_BREAK + HALF + ADDED_2H; // 111

interface Clock {
  status: MatchStatus;
  phase: MatchPhase;
  minute: number | null;
  /** Events at or before this minute are visible. */
  revealMinute: number;
}

/** Derives status and match clock from kickoff and the current time. */
export function clockFor(kickoffISO: string, now: Date): Clock {
  const elapsed = (now.getTime() - new Date(kickoffISO).getTime()) / 60_000;
  if (elapsed < 0) return { status: "scheduled", phase: "NS", minute: null, revealMinute: -1 };
  if (elapsed < HALF + ADDED_1H) {
    const minute = Math.min(HALF + ADDED_1H, Math.floor(elapsed) + 1);
    return { status: "live", phase: "1H", minute, revealMinute: minute };
  }
  if (elapsed < HALF + ADDED_1H + HT_BREAK) {
    return { status: "live", phase: "HT", minute: 45, revealMinute: 45 + ADDED_1H };
  }
  if (elapsed < FULL_TIME_MIN) {
    const minute = Math.min(90 + ADDED_2H, 46 + Math.floor(elapsed - (HALF + ADDED_1H + HT_BREAK)));
    return { status: "live", phase: "2H", minute, revealMinute: minute };
  }
  return { status: "finished", phase: "FT", minute: null, revealMinute: 999 };
}

/** Grid coordinates ("row:col") for a formation, goalkeeper first. */
export function gridFor(formation: string, count: number): string[] {
  const lines = [1, ...formation.split("-").map(Number)];
  const grid: string[] = [];
  lines.forEach((n, row) => {
    for (let c = 1; c <= n; c++) grid.push(`${row + 1}:${c}`);
  });
  while (grid.length < count) grid.push(`${lines.length}:${grid.length - 10}`);
  return grid;
}

interface Shifted {
  shiftMs: number;
  matches: Map<string, DemoMatch>; // id -> shifted match
  byDate: Map<string, DemoMatch[]>;
  byCompetition: Map<string, DemoMatch[]>;
  byTeam: Map<string, DemoMatch[]>;
}

/**
 * The demo dataset, shifted so its anchor day is "today". Statuses, live
 * clocks and visible events are derived from the real wall clock at request time.
 */
export class DemoRepository implements Repository {
  private teamsById = new Map(DATA.teams.map((t) => [t.id, t]));
  private teamsBySlug = new Map(DATA.teams.map((t) => [t.slug, t]));
  private competitionsById = new Map(DATA.competitions.map((c) => [c.id, c]));
  private playersById = new Map(DATA.players.map((p) => [p.id, p]));
  private playersBySlug = new Map(DATA.players.map((p) => [p.slug, p]));
  private squadsByTeam = new Map<string, Player[]>();
  private shiftedCache: { day: string; value: Shifted } | null = null;

  constructor(private readonly now: () => Date = () => new Date()) {
    for (const p of DATA.players) {
      const list = this.squadsByTeam.get(p.teamId) ?? [];
      list.push(p);
      this.squadsByTeam.set(p.teamId, list);
    }
    for (const list of this.squadsByTeam.values()) {
      list.sort(
        (a, b) => POS_ORDER[a.position] - POS_ORDER[b.position] || a.shirtNumber - b.shirtNumber,
      );
    }
  }

  info(): DataSourceInfo {
    return {
      kind: "demo",
      label: "Demo data",
      freshness:
        "Synthetic season generated for development. Results, players and lineups are not real.",
    };
  }

  // ---- shifting ---------------------------------------------------------
  private shifted(): Shifted {
    const today = todayISO(this.now());
    if (this.shiftedCache?.day === today) return this.shiftedCache.value;
    const shiftDays = daysBetween(DATA.anchorDate as ISODate, today);
    const shiftMs = shiftDays * 86_400_000;
    const matches = new Map<string, DemoMatch>();
    const byDate = new Map<string, DemoMatch[]>();
    const byCompetition = new Map<string, DemoMatch[]>();
    const byTeam = new Map<string, DemoMatch[]>();
    for (const raw of DATA.matches) {
      const m: DemoMatch = {
        ...raw,
        kickoff: new Date(new Date(raw.kickoff).getTime() + shiftMs).toISOString(),
      };
      matches.set(m.id, m);
      push(byDate, dateOf(m.kickoff), m);
      push(byCompetition, m.competitionId, m);
      push(byTeam, m.homeTeamId, m);
      push(byTeam, m.awayTeamId, m);
    }
    const value = { shiftMs, matches, byDate, byCompetition, byTeam };
    this.shiftedCache = { day: today, value };
    return value;
  }

  private toMatch(m: DemoMatch, now: Date): Match {
    const clock = clockFor(m.kickoff, now);
    let score = null;
    let halfTimeScore = null;
    if (m.result && clock.status !== "scheduled") {
      if (clock.status === "finished") {
        score = { home: m.result.ft[0], away: m.result.ft[1] };
        halfTimeScore = { home: m.result.ht[0], away: m.result.ht[1] };
      } else {
        const goals = (m.events ?? []).filter((e) => isGoal(e[3]) && e[0] <= clock.revealMinute);
        score = {
          home: goals.filter((e) => e[2] === 0).length,
          away: goals.filter((e) => e[2] === 1).length,
        };
        halfTimeScore =
          clock.phase === "1H" ? null : { home: m.result.ht[0], away: m.result.ht[1] };
      }
    }
    // A match that should have been played but was never simulated: mark postponed.
    const status: MatchStatus =
      !m.result && clock.status !== "scheduled" ? "postponed" : clock.status;
    return {
      id: m.id,
      slug: matchSlug({ homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, kickoff: m.kickoff }),
      competitionId: m.competitionId,
      season: DATA.season,
      round: m.round,
      stage: m.stage,
      kickoff: m.kickoff,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      status,
      phase: status === "postponed" ? "NS" : clock.phase,
      minute: clock.minute,
      score,
      halfTimeScore,
      venue: m.venue,
      attendance: status === "finished" ? m.attendance : undefined,
    };
  }

  private toView(m: DemoMatch, now: Date): MatchView {
    return {
      match: this.toMatch(m, now),
      competition: this.competitionsById.get(m.competitionId)!,
      home: this.teamsById.get(m.homeTeamId)!,
      away: this.teamsById.get(m.awayTeamId)!,
    };
  }

  private toEvents(m: DemoMatch, revealMinute: number): MatchEvent[] {
    return (m.events ?? [])
      .filter((e) => e[0] <= revealMinute)
      .map((e, i) => ({
        id: `${m.id}-e${i}`,
        matchId: m.id,
        minute: e[0],
        addedTime: e[1] || undefined,
        teamId: e[2] === 0 ? m.homeTeamId : m.awayTeamId,
        type: e[3],
        playerId: e[4],
        relatedPlayerId: e[5],
      }));
  }

  private toLineup(teamId: string, l: DemoLineup): TeamLineup {
    const grid = gridFor(l.formation, l.starting.length);
    const mk = (id: string, i: number, g: string): LineupPlayer => {
      const p = this.playersById.get(id)!;
      return {
        playerId: id,
        shirtNumber: p.shirtNumber,
        position: p.position,
        grid: g,
        captain: id === l.captain,
      };
    };
    return {
      teamId,
      formation: l.formation,
      starting: l.starting.map((id, i) => mk(id, i, grid[i])),
      bench: l.bench.map((id, i) => mk(id, i, "")),
      coach: this.teamsById.get(teamId)?.manager,
    };
  }

  // ---- competitions & teams --------------------------------------------
  /**
   * Only competitions that actually hold matches, which is what the database
   * repository has always returned. A competition the site is configured for
   * but has no football in — one added ahead of its first seed — is a name in
   * the navigation leading to empty pages, and both repositories should agree
   * about that.
   */
  async listCompetitions(): Promise<Competition[]> {
    const played = new Set(DATA.matches.map((m) => m.competitionId));
    return DATA.competitions.filter((c) => played.has(c.id)).sort((a, b) => a.order - b.order);
  }
  async getCompetitionBySlug(slug: string): Promise<Competition | null> {
    return DATA.competitions.find((c) => c.slug === slug) ?? null;
  }
  async listTeams(competitionId?: string): Promise<Team[]> {
    const all = competitionId
      ? DATA.teams.filter((t) => t.competitionIds.includes(competitionId))
      : DATA.teams;
    return [...all].sort((a, b) => a.name.localeCompare(b.name));
  }
  async getTeamBySlug(slug: string): Promise<Team | null> {
    return this.teamsBySlug.get(slug) ?? null;
  }
  async getTeamById(id: string): Promise<Team | null> {
    return this.teamsById.get(id) ?? null;
  }
  async getSquad(teamId: string): Promise<Player[]> {
    return this.squadsByTeam.get(teamId) ?? [];
  }
  async getPlayerBySlug(slug: string): Promise<Player | null> {
    return this.playersBySlug.get(slug) ?? null;
  }

  async listPlayers() {
    return [...this.playersBySlug.values()].map((p) => ({ id: p.id, slug: p.slug, name: p.name }));
  }

  // ---- matches -----------------------------------------------------------
  async getMatchesOnDate(date: ISODate): Promise<MatchView[]> {
    const now = this.now();
    const list = this.shifted().byDate.get(date) ?? [];
    return list.map((m) => this.toView(m, now)).sort(byKickoff);
  }
  async getLiveMatches(): Promise<MatchView[]> {
    const now = this.now();
    const today = todayISO(now);
    const list = this.shifted().byDate.get(today) ?? [];
    return list.map((m) => this.toView(m, now)).filter((v) => isLive(v.match, now));
  }
  async holdsLineups(): Promise<boolean> {
    return DATA.matches.some((m) => m.lineups);
  }
  async getMatch(idOrSlug: string): Promise<MatchDetail | null> {
    const shifted = this.shifted();
    const m =
      shifted.matches.get(idOrSlug) ??
      [...shifted.matches.values()].find(
        (x) =>
          matchSlug({ homeTeamId: x.homeTeamId, awayTeamId: x.awayTeamId, kickoff: x.kickoff }) ===
          idOrSlug,
      );
    if (!m) return null;
    const now = this.now();
    const view = this.toView(m, now);
    const clock = clockFor(m.kickoff, now);
    const events = view.match.status === "postponed" ? [] : this.toEvents(m, clock.revealMinute);
    const showLineups = m.lineups && clock.status !== "scheduled";
    const lineups: Lineups | null = showLineups
      ? {
          matchId: m.id,
          home: this.toLineup(m.homeTeamId, m.lineups!.home),
          away: this.toLineup(m.awayTeamId, m.lineups!.away),
        }
      : null;
    const players: Record<string, Player> = {};
    const collect = (id: string | null | undefined) => {
      if (id && !players[id]) players[id] = this.playersById.get(id)!;
    };
    for (const e of events) {
      collect(e.playerId);
      collect(e.relatedPlayerId);
    }
    if (lineups)
      for (const side of [lineups.home, lineups.away])
        for (const p of [...side.starting, ...side.bench]) collect(p.playerId);
    return { view, events, lineups, players };
  }
  async getCompetitionMatches(competitionId: string): Promise<MatchView[]> {
    const now = this.now();
    return (this.shifted().byCompetition.get(competitionId) ?? [])
      .map((m) => this.toView(m, now))
      .sort(byKickoff);
  }
  async getTeamMatches(teamId: string): Promise<MatchView[]> {
    const now = this.now();
    return (this.shifted().byTeam.get(teamId) ?? [])
      .map((m) => this.toView(m, now))
      .sort(byKickoff);
  }

  // ---- derived -----------------------------------------------------------
  async getStandings(competitionId: string, side: TableSide = "all"): Promise<Standings> {
    const teams = await this.listTeams(competitionId);
    const matches = (await this.getCompetitionMatches(competitionId)).map((v) => v.match);
    return computeStandings(
      competitionId,
      DATA.season,
      teams.map((t) => t.id),
      matches,
      this.now().toISOString(),
      side,
    );
  }
  /** The demo season is complete in itself, so counting its goals is the whole truth. */
  async getTopScorers(competitionId: string, limit = 20): Promise<ScorerChart> {
    const now = this.now();
    const played = (this.shifted().byCompetition.get(competitionId) ?? []).filter(
      (m) => clockFor(m.kickoff, now).status !== "scheduled" && m.result,
    );
    const events: MatchEvent[] = [];
    const apps = new Map<string, number>();
    for (const m of played) {
      const clock = clockFor(m.kickoff, now);
      events.push(...this.toEvents(m, clock.revealMinute));
      for (const side of [m.lineups?.home, m.lineups?.away]) {
        for (const id of side?.starting ?? []) apps.set(id, (apps.get(id) ?? 0) + 1);
      }
      for (const e of m.events ?? [])
        if (e[3] === "substitution" && e[5]) apps.set(e[5], (apps.get(e[5]) ?? 0) + 1);
    }
    return { rows: computeScorers(events, apps, limit), source: "matches" };
  }
  async getPlayerSeasonStats(playerId: string): Promise<PlayerSeasonStats | null> {
    const p = this.playersById.get(playerId);
    if (!p) return null;
    const team = this.teamsById.get(p.teamId);
    const total: ScorerRow = {
      playerId,
      teamId: p.teamId,
      goals: 0,
      assists: 0,
      penalties: 0,
      appearances: 0,
    };
    for (const compId of team?.competitionIds ?? []) {
      const { rows } = await this.getTopScorers(compId, 10_000);
      const r = rows.find((x) => x.playerId === playerId);
      if (r) {
        total.goals += r.goals;
        total.assists += r.assists;
        total.penalties += r.penalties;
      }
    }
    // appearances across all competitions
    const now = this.now();
    for (const m of this.shifted().byTeam.get(p.teamId) ?? []) {
      if (clockFor(m.kickoff, now).status === "scheduled" || !m.lineups) continue;
      const side = m.homeTeamId === p.teamId ? m.lineups.home : m.lineups.away;
      const cameOn = (m.events ?? []).some((e) => e[3] === "substitution" && e[5] === playerId);
      if (side.starting.includes(playerId) || cameOn) total.appearances++;
    }
    // The demo season is complete in itself: counting it is the whole truth,
    // so it reports what it is rather than borrowing a provider's authority.
    return { ...total, source: "matches" };
  }

  async getPlayerMatches(playerId: string): Promise<PlayerMatch[]> {
    const p = this.playersById.get(playerId);
    if (!p) return [];
    const now = this.now();
    const out: PlayerMatch[] = [];
    for (const m of this.shifted().byTeam.get(p.teamId) ?? []) {
      const clock = clockFor(m.kickoff, now);
      if (clock.status === "scheduled" || clock.status === "postponed") continue;
      const side = m.homeTeamId === p.teamId ? m.lineups?.home : m.lineups?.away;
      const entry = playerMatchFrom(
        playerId,
        this.toView(m, now),
        side?.starting ?? [],
        this.toEvents(m, clock.revealMinute),
      );
      if (entry) out.push(entry);
    }
    return out.sort(byMostRecent);
  }

  async getHonours(competitionId: string): Promise<Honours | null> {
    return honoursFor(competitionId);
  }
  async getTeamHonours(teamId: string): Promise<TeamHonour[]> {
    const out: TeamHonour[] = [];
    for (const h of allHonours()) {
      const seasons = h.entries.filter((e) => e.winnerTeamId === teamId).map((e) => e.season);
      if (seasons.length) {
        const comp = this.competitionsById.get(h.competitionId);
        out.push({ competition: comp ?? { id: h.competitionId, name: h.name }, seasons });
      }
    }
    return out;
  }

  async searchIndex(): Promise<SearchItem[]> {
    const items: SearchItem[] = [];
    for (const c of await this.listCompetitions()) {
      items.push({
        type: "competition",
        id: c.id,
        slug: c.slug,
        label: c.name,
        sublabel: c.country,
        href: `/leagues/${c.slug}`,
        keywords: [c.shortName, c.country, ...(ALIASES[c.id] ?? [])],
      });
    }
    for (const t of DATA.teams) {
      items.push({
        type: "team",
        id: t.id,
        slug: t.slug,
        label: t.name,
        sublabel: `${t.city} · ${t.country}`,
        href: `/teams/${t.slug}`,
        keywords: [t.shortName, t.code, t.city],
      });
    }
    return items;
  }
}

const ALIASES: Record<string, string[]> = {
  epl: ["EPL", "English Premier League", "England"],
  laliga: ["Primera División", "LaLiga", "Spain"],
  bundesliga: ["Germany", "BL1"],
  seriea: ["Italy", "Calcio"],
  ucl: ["UCL", "Champions League", "Europe"],
  uel: ["UEL", "Europa League", "Europe"],
};

const POS_ORDER: Record<Position, number> = { GK: 0, DF: 1, MF: 2, FW: 3 };

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function byKickoff(a: MatchView, b: MatchView) {
  return a.match.kickoff.localeCompare(b.match.kickoff);
}

const isGoal = (t: string) => t === "goal" || t === "penalty" || t === "own_goal";
