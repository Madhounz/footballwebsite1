import type { ISODate } from "../dates";
import type {
  Competition,
  DataSourceInfo,
  Honours,
  Lineups,
  Match,
  MatchEvent,
  MatchView,
  Player,
  ScorerRow,
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

  /** All matches on a calendar day (UTC), any competition, sorted by kickoff. */
  getMatchesOnDate(date: ISODate): Promise<MatchView[]>;
  getLiveMatches(): Promise<MatchView[]>;
  getMatch(id: string): Promise<MatchDetail | null>;
  getCompetitionMatches(competitionId: string): Promise<MatchView[]>;
  getTeamMatches(teamId: string): Promise<MatchView[]>;

  getStandings(competitionId: string): Promise<Standings>;
  getTopScorers(competitionId: string, limit?: number): Promise<ScorerRow[]>;
  getPlayerSeasonStats(playerId: string): Promise<ScorerRow | null>;

  getHonours(competitionId: string): Promise<Honours | null>;
  getTeamHonours(teamId: string): Promise<TeamHonour[]>;

  searchIndex(): Promise<SearchItem[]>;
}

export function isFinished(m: Match): boolean {
  return m.status === "finished";
}
