/**
 * Domain model shared by the UI, the demo dataset and the sync pipeline.
 * Everything the site renders is expressed in these types, so a data source
 * only has to implement `Repository` (see ./data/repository.ts).
 */

export type CompetitionKind = "league" | "cup";

export interface Competition {
  id: string; // stable internal id, e.g. "epl"
  slug: string; // url segment, e.g. "premier-league"
  name: string; // "Premier League"
  shortName: string; // "PL"
  country: string; // "England" | "Europe"
  countryCode: string; // ISO 3166-1 alpha-2, "EU" for UEFA
  kind: CompetitionKind;
  /** Display order on the home page and in navigation. */
  order: number;
  /** Current season label, e.g. "2026/27". */
  season: string;
  /** Number of teams in the (league phase) table. */
  teamCount: number;
  /** Table zones: how many places qualify / relegate. Drives the coloured markers. */
  zones: TableZone[];
  /** Total rounds/matchdays in the league phase. */
  rounds: number;
  /** Accent colour used sparingly (competition pill). */
  color: string;
}

export interface TableZone {
  /** 1-based inclusive range of positions. */
  from: number;
  to: number;
  label: string; // "Champions League", "Relegation", "Knockout play-offs" …
  tone: "top" | "second" | "third" | "bottom";
}

export interface Team {
  id: string;
  slug: string;
  name: string; // "Manchester United"
  shortName: string; // "Man United"
  code: string; // "MUN"
  country: string;
  countryCode: string;
  city: string;
  stadium: string;
  founded: number;
  colors: [string, string]; // primary, secondary (hex)
  /** Competition ids the team takes part in this season. */
  competitionIds: string[];
  /** Domestic league competition id, when the team's league is tracked. */
  leagueId?: string;
  manager?: string;
  /** Official crest image from the data provider; the generated crest is used when absent. */
  crestUrl?: string;
}

export type Position = "GK" | "DF" | "MF" | "FW";

export interface Player {
  id: string;
  slug: string;
  name: string;
  firstName: string;
  lastName: string;
  teamId: string;
  position: Position;
  shirtNumber: number;
  nationality: string; // country name
  nationalityCode: string; // ISO alpha-2
  dateOfBirth: string; // ISO date
  heightCm?: number;
  preferredFoot?: "left" | "right" | "both";
}

export type MatchStatus =
  | "scheduled" // not started
  | "live" // in play, including half time
  | "finished"
  | "postponed"
  | "cancelled";

export type MatchPhase = "1H" | "HT" | "2H" | "ET" | "PEN" | "FT" | "NS";

export interface Score {
  home: number;
  away: number;
}

export interface Match {
  id: string;
  /** URL segment: "arsenal-vs-chelsea-2026-09-19". Derived, see match-slug.ts. */
  slug: string;
  competitionId: string;
  season: string;
  round: number; // matchday
  stage?: string; // "League phase", "Round of 16" …
  /** ISO 8601 kickoff time in UTC. */
  kickoff: string;
  homeTeamId: string;
  awayTeamId: string;
  status: MatchStatus;
  phase: MatchPhase;
  /** Match clock minute when live; null otherwise. */
  minute: number | null;
  score: Score | null; // current / final score
  halfTimeScore: Score | null;
  venue?: string;
  attendance?: number;
  referee?: string;
  /** Sources disagreed on this settled result; shown from the primary source, flagged for review. */
  disputed?: boolean;
  disputedFields?: string[];
}

export type EventType =
  | "goal"
  | "own_goal"
  | "penalty"
  | "missed_penalty"
  | "yellow"
  | "second_yellow"
  | "red"
  | "substitution"
  | "var";

export interface MatchEvent {
  id: string;
  matchId: string;
  minute: number;
  addedTime?: number; // minute 45+2 -> minute 45, addedTime 2
  teamId: string;
  type: EventType;
  playerId: string | null;
  /** Assist for goals, incoming player for substitutions. */
  relatedPlayerId?: string | null;
  detail?: string;
}

export interface LineupPlayer {
  playerId: string;
  shirtNumber: number;
  position: Position;
  /** Grid position "row:col" from the goalkeeper (row 1) forwards. */
  grid: string;
  captain?: boolean;
}

export interface TeamLineup {
  teamId: string;
  formation: string; // "4-3-3"
  starting: LineupPlayer[];
  bench: LineupPlayer[];
  coach?: string;
}

export interface Lineups {
  matchId: string;
  home: TeamLineup;
  away: TeamLineup;
}

export interface StandingRow {
  position: number;
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Last five results, oldest first. */
  form: FormResult[];
  /** Position change since the previous round; positive = climbed. */
  movement: number;
}

export type FormResult = "W" | "D" | "L";

export interface Standings {
  competitionId: string;
  season: string;
  updatedAt: string;
  rows: StandingRow[];
}

export interface ScorerRow {
  playerId: string;
  teamId: string;
  goals: number;
  assists: number;
  penalties: number;
  appearances: number;
}

export interface HonourEntry {
  season: string; // "2024/25"
  winner: string; // canonical team name (may be a team not in the dataset)
  winnerTeamId?: string;
  runnerUp?: string;
  runnerUpTeamId?: string;
  detail?: string; // final score, venue …
}

export interface Honours {
  competitionId: string;
  name: string;
  /** Most recent first. */
  entries: HonourEntry[];
  /** Aggregated title counts, most first. */
  mostTitles: { team: string; teamId?: string; count: number }[];
}

export interface SearchItem {
  type: "competition" | "team" | "player";
  id: string;
  slug: string;
  label: string;
  sublabel: string;
  href: string;
  keywords: string[];
}

/** A match with its two teams and competition resolved — what most views need. */
export interface MatchView {
  match: Match;
  competition: Competition;
  home: Team;
  away: Team;
}

export interface DataSourceInfo {
  kind: "demo" | "db";
  label: string;
  /** Human-readable freshness statement for the footer. */
  freshness: string;
}
