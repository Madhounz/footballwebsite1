/**
 * Pipeline contracts. A Provider turns a third-party API into ProviderRecords
 * expressed in our own domain vocabulary. The reconciler compares records for
 * the same entity across providers and produces a single trusted value.
 */
import type { Competition, Match, MatchEvent, Player, Position, Team, TeamLineup } from "../types";

export type ProviderId = "football-data" | "api-football" | (string & {});

export interface ProviderRecord<T> {
  provider: ProviderId;
  /** The provider's own id for this entity. */
  externalId: string;
  /** When the provider said this was last updated, if it says. */
  updatedAt?: string;
  value: T;
}

/** A match as one provider sees it, with team identities already mapped to our ids. */
// `slug` is derived from the teams and date, so providers never supply it.
export type ProviderMatch = Omit<Match, "season" | "minute" | "phase" | "slug"> & {
  minute?: number | null;
  phase?: Match["phase"];
  events?: MatchEvent[];
  lineups?: { home: TeamLineup; away: TeamLineup };
  /**
   * A partial record carries only detail (events, line-ups, minute) for a match
   * another provider already describes; its other fields must not take part in
   * reconciliation.
   */
  partial?: boolean;
  /**
   * These events are the provider's complete post-match list, not a snapshot of
   * a match still in play. Stored as `Match.eventsFinalAt` so a timeline that
   * stopped halfway is never mistaken for a finished one.
   */
  eventsFinal?: boolean;
};

/**
 * One row of a competition's scorer chart as a provider publishes it. Goals are
 * the provider's own count for the season, not a tally of events we hold.
 */
export interface ProviderScorer {
  /** Our player id, resolved (and created when new) through the store. */
  playerId: string;
  teamId: string;
  goals: number;
  assists: number;
  penalties: number;
  appearances: number;
}

/** A match the store knows about that may need detail from a provider. */
export interface MatchNeedingDetail {
  id: string;
  competitionId: string;
  kickoff: string;
  homeTeamId: string;
  awayTeamId: string;
  status: Match["status"];
  hasLineups: boolean;
  hasEvents: boolean;
  /** The complete post-match event list has been fetched; the timeline is settled. */
  hasFinalEvents: boolean;
  /** The provider's own id for this match, when already learned. */
  externalId: string | null;
  /**
   * An older match picked up by the catch-up pass rather than one around
   * kick-off. Detail for these is worth having but never at the cost of
   * covering a match in play, so providers spend on them last and only with
   * plenty of quota left.
   */
  catchUp?: boolean;
}

/** How far back the catch-up pass looks for matches whose timeline never completed. */
export interface CatchUpWindow {
  days: number;
  /** How many matches one run may take on. */
  limit: number;
}

/** What a detail provider needs from the store. */
export interface DetailStore {
  /** Matches kicking off within [now - afterMin, now + beforeMin] for a provider, with what is already stored. */
  matchesNeedingDetail(
    provider: string,
    now: Date,
    beforeMin: number,
    afterMin: number,
    catchUp?: CatchUpWindow,
  ): Promise<MatchNeedingDetail[]>;
  /** Remember a provider's id for one of our matches. */
  saveMatchAlias(provider: string, matchId: string, externalId: string): Promise<void>;
  /**
   * Our ids for the players who started a match, when the line-ups are known.
   * A starter cannot come on as a substitute, which is how the direction of a
   * substitution is proved rather than assumed.
   */
  startingPlayerIds(matchId: string): Promise<Set<string>>;
}

/** A player as a provider names them inside a match (events, line-ups). */
export interface ProviderPlayerRef {
  externalId: string;
  name: string;
  shirtNumber?: number | null;
  position?: Position | null;
}

/**
 * Maps a provider's player onto one of ours for a given team, creating a
 * player when nothing matches. Supplied by the store so the pipeline can run
 * against a database or in dry-run mode.
 */
export type PlayerResolver = (teamId: string, player: ProviderPlayerRef) => Promise<string>;

export interface ProviderTeam extends Omit<
  Team,
  "competitionIds" | "slug" | "colors" | "leagueId"
> {
  colors?: [string, string];
  /** True when the name matched nothing we know and the id was minted from the name. */
  isNew?: boolean;
  squad?: ProviderSquadPlayer[];
}

export interface ProviderSquadPlayer extends Omit<Player, "slug" | "teamId" | "id"> {
  externalId: string;
}

export interface FetchWindow {
  fromDate: string; // YYYY-MM-DD inclusive
  toDate: string; // YYYY-MM-DD inclusive
}

export interface Provider {
  id: ProviderId;
  /** Relative trust used to break ties when there is no majority. 0..1 */
  weight: number;
  /** Requests spent this run, when the provider meters itself. */
  readonly requestsMade?: number;
  /** Competitions this provider can serve (our ids). */
  supports(competitionId: string): boolean;
  fetchMatches(
    competition: Competition,
    window: FetchWindow,
  ): Promise<ProviderRecord<ProviderMatch>[]>;
  /**
   * Optional: several competitions in one request. The live refresh prefers it
   * so a minute-by-minute poll costs one call rather than one per competition.
   */
  fetchAcross?(
    competitions: Competition[],
    window: FetchWindow,
  ): Promise<ProviderRecord<ProviderMatch>[]>;
  /**
   * The competition's scorer chart, when the provider publishes one. Optional:
   * a provider that only knows matches does not implement it.
   */
  fetchScorers?(competition: Competition): Promise<ProviderScorer[]>;
  fetchTeams(competition: Competition): Promise<ProviderRecord<ProviderTeam>[]>;
  fetchSquad(teamExternalId: string): Promise<ProviderRecord<ProviderSquadPlayer>[]>;
}

/** One field on one entity where providers disagree. */
export interface Conflict {
  entityType: "match" | "team" | "player";
  entityId: string;
  field: string;
  /** provider -> JSON-serialisable value */
  values: Record<string, unknown>;
  /** Extra evidence handed to the resolver (kickoff, team names, minute ...). */
  context: Record<string, unknown>;
}

export interface Resolution {
  value: unknown;
  resolvedBy: "consensus" | "majority" | "weight" | "ai" | "unresolved";
  confidence: number; // 0..1
  reasoning?: string;
}
