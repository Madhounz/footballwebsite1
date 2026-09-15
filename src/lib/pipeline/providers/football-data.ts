import type { Competition, MatchStatus } from "../../types";
import { COMPETITION_CODES, resolveTeamId } from "../normalize";
import type {
  FetchWindow,
  Provider,
  ProviderMatch,
  ProviderRecord,
  ProviderSquadPlayer,
  ProviderTeam,
} from "../types";
import { slugify } from "../../slug";

/**
 * football-data.org v4 — https://www.football-data.org/documentation/quickstart
 * Free tier: PL, PD, BL1, SA, CL (and more) at 10 requests/minute. EL needs a paid tier.
 */
const BASE = "https://api.football-data.org/v4";

interface FDMatch {
  id: number;
  utcDate: string;
  status:
    | "SCHEDULED"
    | "TIMED"
    | "IN_PLAY"
    | "PAUSED"
    | "FINISHED"
    | "POSTPONED"
    | "SUSPENDED"
    | "CANCELLED"
    | "AWARDED";
  matchday: number | null;
  stage: string;
  lastUpdated: string;
  minute?: number | null;
  homeTeam: { id: number; name: string; shortName: string; tla: string };
  awayTeam: { id: number; name: string; shortName: string; tla: string };
  score: {
    duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  venue?: string;
  referees?: { name: string; type: string }[];
}

interface FDTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  address: string;
  founded: number;
  clubColors: string;
  venue: string;
  area: { name: string; code: string };
  coach?: { name: string | null };
  squad?: {
    id: number;
    name: string;
    position: string | null;
    dateOfBirth: string;
    nationality: string;
    shirtNumber?: number | null;
  }[];
}

const STATUS: Record<FDMatch["status"], MatchStatus> = {
  SCHEDULED: "scheduled",
  TIMED: "scheduled",
  IN_PLAY: "live",
  PAUSED: "live",
  FINISHED: "finished",
  AWARDED: "finished",
  POSTPONED: "postponed",
  SUSPENDED: "postponed",
  CANCELLED: "cancelled",
};

export interface FootballDataOptions {
  apiKey: string;
  knownTeams: { id: string; name: string; shortName: string }[];
  fetchImpl?: typeof fetch;
  /** Called for provider team names that map to no known team. */
  onUnknownTeam?: (name: string, externalId: string) => void;
}

export class FootballDataProvider implements Provider {
  readonly id = "football-data";
  readonly weight = 0.8;
  private fetchImpl: typeof fetch;

  constructor(private readonly opts: FootballDataOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  supports(competitionId: string): boolean {
    return Boolean(COMPETITION_CODES[competitionId]?.footballData);
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetchImpl(`${BASE}${path}`, {
      headers: { "X-Auth-Token": this.opts.apiKey },
    });
    if (res.status === 429)
      throw new Error(
        `football-data rate limited (${res.headers.get("X-RequestCounter-Reset") ?? "?"}s)`,
      );
    if (!res.ok) throw new Error(`football-data ${res.status} for ${path}`);
    return (await res.json()) as T;
  }

  private teamId(t: { name: string; shortName: string; tla: string; id: number }): string | null {
    const id =
      resolveTeamId(t.name, this.opts.knownTeams) ??
      resolveTeamId(t.shortName, this.opts.knownTeams);
    if (!id) this.opts.onUnknownTeam?.(t.name, String(t.id));
    return id;
  }

  async fetchMatches(
    competition: Competition,
    window: FetchWindow,
  ): Promise<ProviderRecord<ProviderMatch>[]> {
    const code = COMPETITION_CODES[competition.id]?.footballData;
    if (!code) return [];
    const data = await this.get<{ matches: FDMatch[] }>(
      `/competitions/${code}/matches?dateFrom=${window.fromDate}&dateTo=${window.toDate}`,
    );
    const out: ProviderRecord<ProviderMatch>[] = [];
    for (const m of data.matches) {
      const home = this.teamId(m.homeTeam);
      const away = this.teamId(m.awayTeam);
      if (!home || !away) continue;
      const status = STATUS[m.status] ?? "scheduled";
      const ft = m.score.fullTime;
      const ht = m.score.halfTime;
      out.push({
        provider: this.id,
        externalId: String(m.id),
        updatedAt: m.lastUpdated,
        value: {
          id: "",
          competitionId: competition.id,
          round: m.matchday ?? 0,
          stage: competition.kind === "cup" ? humanStage(m.stage) : undefined,
          kickoff: m.utcDate,
          homeTeamId: home,
          awayTeamId: away,
          status,
          phase:
            status === "finished"
              ? m.score.duration === "PENALTY_SHOOTOUT"
                ? "PEN"
                : m.score.duration === "EXTRA_TIME"
                  ? "ET"
                  : "FT"
              : status === "live"
                ? m.status === "PAUSED"
                  ? "HT"
                  : "2H"
                : "NS",
          minute: m.minute ?? null,
          score: ft.home != null && ft.away != null ? { home: ft.home, away: ft.away } : null,
          halfTimeScore:
            ht.home != null && ht.away != null ? { home: ht.home, away: ht.away } : null,
          venue: m.venue,
          referee: m.referees?.find((r) => r.type === "REFEREE")?.name,
        },
      });
    }
    return out;
  }

  async fetchTeams(competition: Competition): Promise<ProviderRecord<ProviderTeam>[]> {
    const code = COMPETITION_CODES[competition.id]?.footballData;
    if (!code) return [];
    const data = await this.get<{ teams: FDTeam[] }>(`/competitions/${code}/teams`);
    return data.teams.map((t) => {
      const [c1, c2] = parseColors(t.clubColors);
      return {
        provider: this.id,
        externalId: String(t.id),
        value: {
          id: resolveTeamId(t.name, this.opts.knownTeams) ?? slugify(t.name),
          name: t.name,
          shortName: t.shortName,
          code: t.tla,
          country: t.area.name,
          countryCode: t.area.code,
          city: (t.address ?? "").split(" ").slice(-2, -1)[0] ?? "",
          stadium: t.venue,
          founded: t.founded,
          colors: c1 && c2 ? [c1, c2] : undefined,
          manager: t.coach?.name ?? undefined,
        },
      };
    });
  }

  async fetchSquad(teamExternalId: string): Promise<ProviderRecord<ProviderSquadPlayer>[]> {
    const t = await this.get<FDTeam>(`/teams/${teamExternalId}`);
    return (t.squad ?? []).map((p) => {
      const parts = p.name.split(" ");
      return {
        provider: this.id,
        externalId: String(p.id),
        value: {
          externalId: String(p.id),
          name: p.name,
          firstName: parts[0],
          lastName: parts.slice(1).join(" ") || parts[0],
          position: mapPosition(p.position),
          shirtNumber: p.shirtNumber ?? 0,
          nationality: p.nationality,
          nationalityCode: "",
          dateOfBirth: p.dateOfBirth,
        },
      };
    });
  }
}

function humanStage(stage: string): string {
  return stage
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function mapPosition(p: string | null): "GK" | "DF" | "MF" | "FW" {
  const s = (p ?? "").toLowerCase();
  if (s.includes("keeper")) return "GK";
  if (s.includes("back") || s.includes("defen")) return "DF";
  if (s.includes("mid")) return "MF";
  return "FW";
}

const COLOR_WORDS: Record<string, string> = {
  red: "#d62828",
  white: "#ffffff",
  blue: "#1d4ed8",
  "sky blue": "#6cabdd",
  "navy blue": "#1c2c5b",
  black: "#111111",
  yellow: "#f5c518",
  claret: "#670e36",
  green: "#1b7f3b",
  orange: "#f68b1f",
  purple: "#5b2a86",
  maroon: "#7a263a",
  grey: "#8a8a84",
  gold: "#c9a227",
};

function parseColors(s: string | null): [string | undefined, string | undefined] {
  const words = (s ?? "")
    .toLowerCase()
    .split("/")
    .map((w) => w.trim());
  return [COLOR_WORDS[words[0]], COLOR_WORDS[words[1]] ?? (words[0] ? "#ffffff" : undefined)];
}
