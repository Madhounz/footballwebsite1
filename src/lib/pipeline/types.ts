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
export type ProviderMatch = Omit<Match, "season" | "minute" | "phase"> & {
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
};

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
  /** The provider's own id for this match, when already learned. */
  externalId: string | null;
}

/** What a detail provider needs from the store. */
export interface DetailStore {
  /** Matches kicking off within [now - afterMin, now + beforeMin] for a provider, with what is already stored. */
  matchesNeedingDetail(
    provider: string,
    now: Date,
    beforeMin: number,
    afterMin: number,
  ): Promise<MatchNeedingDetail[]>;
  /** Remember a provider's id for one of our matches. */
  saveMatchAlias(provider: string, matchId: string, externalId: string): Promise<void>;
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
  /** Competitions this provider can serve (our ids). */
  supports(competitionId: string): boolean;
  fetchMatches(
    competition: Competition,
    window: FetchWindow,
  ): Promise<ProviderRecord<ProviderMatch>[]>;
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
