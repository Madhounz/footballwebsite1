/**
 * Pipeline contracts. A Provider turns a third-party API into ProviderRecords
 * expressed in our own domain vocabulary. The reconciler compares records for
 * the same entity across providers and produces a single trusted value.
 */
import type { Competition, Match, MatchEvent, Player, Team } from "../types";

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
};

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
