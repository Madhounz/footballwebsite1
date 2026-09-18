import type { ISODate } from "../dates";
import type { PlayerSeasonStats } from "./player-stats";
import type {
  Competition,
  DataSourceInfo,
  Honours,
  Lineups,
  Match,
  MatchEvent,
  MatchView,
  Player,
  ScorerChart,
  TableSide,
  SearchItem,
  Standings,
  Team,
} from "../types";

export interface MatchDetail {
  view: MatchView;
  events: MatchEvent[];
  lineups: Lineups | null;
  /** Players referenced by events and lineups, keyed by id. */
  players: Record<string, Player>;
}

/** One appearance, with what the player did in it. Derived from line-ups and events. */
export interface PlayerMatch {
  view: MatchView;
  started: boolean;
  /** Minute they came on, when they came on. */
  onMinute: number | null;
  /** Minute they were replaced, when they were. */
  offMinute: number | null;
  /** Nominal minutes played; stoppage time is not counted. */
  minutes: number;
  goals: number;
  ownGoals: number;
  assists: number;
  yellow: number;
  red: boolean;
}

export interface TeamHonour {
  competition: Competition | { id: string; name: string; slug?: string };
  seasons: string[];
}

/**
 * Everything the UI needs, behind one interface. Implemented by the demo dataset
 * and by the PostgreSQL/Prisma store the sync pipeline fills.
 */
export interface Repository {
  info(): DataSourceInfo;

  listCompetitions(): Promise<Competition[]>;
  getCompetitionBySlug(slug: string): Promise<Competition | null>;

  listTeams(competitionId?: string): Promise<Team[]>;
  getTeamBySlug(slug: string): Promise<Team | null>;
  getTeamById(id: string): Promise<Team | null>;
  getSquad(teamId: string): Promise<Player[]>;

  getPlayerBySlug(slug: string): Promise<Player | null>;
  /** Every player, for the sitemap. Slug and name only — squads come from `getSquad`. */
  listPlayers(): Promise<Pick<Player, "id" | "slug" | "name">[]>;

  /** All matches on a calendar day (UTC), any competition, sorted by kickoff. */
  getMatchesOnDate(date: ISODate): Promise<MatchView[]>;
  getLiveMatches(): Promise<MatchView[]>;
  getMatch(id: string): Promise<MatchDetail | null>;
  /**
   * Whether this deployment holds any line-up at all.
   *
   * Line-ups come from the secondary provider, and a deployment running
   * without one holds none — so "line-ups are published about an hour before
   * kick-off" is a promise it cannot keep, on every fixture, for as long as
   * that is true. The page needs to be able to tell that from a single match
   * whose line-ups have not landed yet.
   */
  holdsLineups(): Promise<boolean>;
  /**
   * Whether any match carries a timeline — goals, cards, substitutions. The
   * about page asks rather than being told, so nothing on it can go stale the
   * day a provider starts or stops serving them.
   */
  holdsMatchEvents(): Promise<boolean>;
  /** This season's matches only — a stored past season is not part of them. */
  getCompetitionMatches(competitionId: string): Promise<MatchView[]>;
  /** This season's matches only, across every competition the club is in. */
  getTeamMatches(teamId: string): Promise<MatchView[]>;

  /** The full table, or only each team's home or away half of it. */
  getStandings(competitionId: string, side?: TableSide): Promise<Standings>;
  getTopScorers(competitionId: string, limit?: number): Promise<ScorerChart>;
  /**
   * A player's season, with where the numbers came from: the competition's
   * chart, our own events, or nowhere at all — which a page has to be able to
   * tell apart from a genuine nought.
   */
  getPlayerSeasonStats(playerId: string): Promise<PlayerSeasonStats | null>;
  /** Every match the player appeared in this season, most recent first. */
  getPlayerMatches(playerId: string): Promise<PlayerMatch[]>;

  getHonours(competitionId: string): Promise<Honours | null>;
  getTeamHonours(teamId: string): Promise<TeamHonour[]>;

  searchIndex(): Promise<SearchItem[]>;
}

export function isFinished(m: Match): boolean {
  return m.status === "finished";
}
