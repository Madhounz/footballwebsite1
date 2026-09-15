import type { Competition, EventType, Player, Team } from "../types";

/** Compact on-disk shape of data/demo/dataset.json. */
export interface DemoDataset {
  version: 1;
  generatedAt: string;
  /** The date the generator treated as "today". Shifted to the real today at runtime. */
  anchorDate: string;
  season: string;
  competitions: Competition[];
  teams: Team[];
  players: Player[];
  matches: DemoMatch[];
}

/** [minute, addedTime, side (0 home / 1 away), type, playerId, relatedPlayerId] */
export type DemoEvent = [number, number, 0 | 1, EventType, string, string | null];

export interface DemoLineup {
  formation: string;
  starting: string[];
  bench: string[];
  captain: string;
}

export interface DemoMatch {
  id: string;
  competitionId: string;
  round: number;
  stage?: string;
  kickoff: string; // ISO, relative to anchorDate
  homeTeamId: string;
  awayTeamId: string;
  venue?: string;
  attendance?: number;
  /** Present when the match has been simulated (kickoff on or before anchor). */
  result?: { ft: [number, number]; ht: [number, number] };
  events?: DemoEvent[];
  lineups?: { home: DemoLineup; away: DemoLineup };
}
