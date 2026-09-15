import type { Competition, MatchStatus, Position } from "../../types";
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
 *
 * Matches are fetched for the whole season in one request per competition and
 * filtered locally, which keeps every run inside the rate limit and lets the
 * table be rebuilt from scratch each time.
 */
const BASE = "https://api.football-data.org/v4";
const MIN_GAP_MS = 6_500; // 10 requests / minute with headroom

interface FDMatch {
  id: number;
  /** Present only on /v4/matches, which spans competitions. */
  competition?: { id: number; code: string; name: string };
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
  shortName: string | null;
  tla: string | null;
  crest?: string | null;
  address: string | null;
  founded: number | null;
  clubColors: string | null;
  venue: string | null;
  area: { name: string; code: string };
  coach?: { name: string | null } | null;
  squad?: {
    id: number;
    name: string;
    position: string | null;
    dateOfBirth: string | null;
    nationality: string | null;
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
  /** Season start year, e.g. 2026 for 2026/27. */
  season: number;
  /** Mutable: teams discovered by fetchTeams are appended so later calls resolve them. */
  knownTeams: { id: string; name: string; shortName: string }[];
  fetchImpl?: typeof fetch;
  /** Called for provider team names that map to no known team. */
  onUnknownTeam?: (name: string, externalId: string) => void;
  log?: (line: string) => void;
  /** Disable the rate-limit pacing (tests). */
  noThrottle?: boolean;
  /**
   * Milliseconds to wait between requests. The free tier allows 10 a minute;
   * the default paces a season-wide run, the live refresh sets it lower
   * because it makes at most a handful of calls per minute.
   */
  minGapMs?: number;
}

export class FootballDataProvider implements Provider {
  readonly id = "football-data";
  /** Primary source for fixtures and results: highest trust, so ties settle here. */
  readonly weight = 0.85;
  private fetchImpl: typeof fetch;
  private lastRequest = 0;
  private readonly minGap: number;
  /** Requests spent this run. */
  requestsMade = 0;

  constructor(private readonly opts: FootballDataOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.minGap = opts.minGapMs ?? MIN_GAP_MS;
  }

  supports(competitionId: string): boolean {
    return Boolean(COMPETITION_CODES[competitionId]?.footballData);
  }

  private async get<T>(path: string): Promise<T> {
    if (!this.opts.noThrottle) {
      const wait = this.lastRequest + this.minGap - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastRequest = Date.now();
    }
    const res = await this.fetchImpl(`${BASE}${path}`, {
      headers: { "X-Auth-Token": this.opts.apiKey },
    });
    this.requestsMade++;
    if (res.status === 429) {
      throw new Error(
        `football-data rate limited; retry in ${res.headers.get("X-RequestCounter-Reset") ?? "?"}s`,
      );
    }
    if (res.status === 403)
      throw new Error(`football-data 403 for ${path}: competition not in your plan or bad key`);
    if (!res.ok) throw new Error(`football-data ${res.status} for ${path}`);
    return (await res.json()) as T;
  }

  private teamId(t: {
    name: string;
    shortName: string | null;
    tla: string | null;
    id: number;
  }): string | null {
    const id =
      resolveTeamId(t.name, this.opts.knownTeams) ??
      (t.shortName ? resolveTeamId(t.shortName, this.opts.knownTeams) : null);
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
      `/competitions/${code}/matches?season=${this.opts.season}`,
    );
    const out: ProviderRecord<ProviderMatch>[] = [];
    for (const m of data.matches) {
      const day = m.utcDate.slice(0, 10);
      if (day < window.fromDate || day > window.toDate) continue;
      const rec = this.toRecord(competition, m);
      if (rec) out.push(rec);
    }
    return out;
  }

  /**
   * Every competition in one request. `/v4/matches` takes a date range and a
   * list of competition codes, so the live refresh costs a single call instead
   * of one per competition. Falls back to per-competition requests when the
   * endpoint is unavailable on the plan.
   */
  async fetchAcross(
    competitions: Competition[],
    window: FetchWindow,
  ): Promise<ProviderRecord<ProviderMatch>[]> {
    const byCode = new Map<string, Competition>();
    for (const c of competitions) {
      const code = COMPETITION_CODES[c.id]?.footballData;
      if (code) byCode.set(code, c);
    }
    if (byCode.size === 0) return [];
    const codes = [...byCode.keys()].join(",");
    const query = `?competitions=${codes}&dateFrom=${window.fromDate}&dateTo=${window.toDate}`;
    let matches: FDMatch[];
    try {
      matches = (await this.get<{ matches: FDMatch[] }>(`/matches${query}`)).matches;
    } catch (e) {
      this.opts.log?.(
        `football-data: combined match request failed (${String(e instanceof Error ? e.message : e)}); asking per competition`,
      );
      const out: ProviderRecord<ProviderMatch>[] = [];
      for (const [code, competition] of byCode) {
        const data = await this.get<{ matches: FDMatch[] }>(
          `/competitions/${code}/matches?dateFrom=${window.fromDate}&dateTo=${window.toDate}`,
        );
        for (const m of data.matches) {
          const rec = this.toRecord(competition, m);
          if (rec) out.push(rec);
        }
      }
      return out;
    }
    const out: ProviderRecord<ProviderMatch>[] = [];
    for (const m of matches) {
      const competition = m.competition?.code ? byCode.get(m.competition.code) : undefined;
      if (!competition) continue;
      const rec = this.toRecord(competition, m);
      if (rec) out.push(rec);
    }
    return out;
  }

  private toRecord(competition: Competition, m: FDMatch): ProviderRecord<ProviderMatch> | null {
    const home = this.teamId(m.homeTeam);
    const away = this.teamId(m.awayTeam);
    if (!home || !away) return null;
    const status = STATUS[m.status] ?? "scheduled";
    const ft = m.score.fullTime;
    const ht = m.score.halfTime;
    return {
      provider: this.id,
      externalId: String(m.id),
      updatedAt: m.lastUpdated,
      value: {
        id: "",
        competitionId: competition.id,
        round: m.matchday ?? 0,
        stage: competition.kind === "cup" ? humanStage(m.stage) : undefined,
        kickoff: new Date(m.utcDate).toISOString(),
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
        halfTimeScore: ht.home != null && ht.away != null ? { home: ht.home, away: ht.away } : null,
        venue: m.venue,
        referee: m.referees?.find((r) => r.type === "REFEREE")?.name,
      },
    };
  }

  /**
   * Teams taking part in the competition this season, with squads. Names that
   * match nothing known get an id minted from the name and are flagged `isNew`;
   * they are appended to `knownTeams` so their matches resolve in the same run.
   */
  async fetchTeams(competition: Competition): Promise<ProviderRecord<ProviderTeam>[]> {
    const code = COMPETITION_CODES[competition.id]?.footballData;
    if (!code) return [];
    const data = await this.get<{ teams: FDTeam[] }>(
      `/competitions/${code}/teams?season=${this.opts.season}`,
    );
    return data.teams.map((t) => {
      const known =
        resolveTeamId(t.name, this.opts.knownTeams) ??
        (t.shortName ? resolveTeamId(t.shortName, this.opts.knownTeams) : null);
      const id = known ?? slugify(t.shortName ?? t.name);
      const shortName = t.shortName ?? t.name;
      if (!known) this.opts.knownTeams.push({ id, name: t.name, shortName });
      const [c1, c2] = parseColors(t.clubColors);
      return {
        provider: this.id,
        externalId: String(t.id),
        value: {
          id,
          isNew: !known,
          name: t.name,
          shortName,
          code: (t.tla ?? shortName.slice(0, 3)).toUpperCase(),
          country: t.area.name,
          countryCode: areaCode(t.area.code),
          city: cityFromAddress(t.address),
          stadium: t.venue ?? "",
          founded: t.founded ?? 0,
          colors: c1 && c2 ? [c1, c2] : undefined,
          manager: t.coach?.name ?? undefined,
          crestUrl: t.crest ?? undefined,
          squad: (t.squad ?? []).map((p) => squadPlayer(p)),
        },
      };
    });
  }

  async fetchSquad(teamExternalId: string): Promise<ProviderRecord<ProviderSquadPlayer>[]> {
    const t = await this.get<FDTeam>(`/teams/${teamExternalId}`);
    return (t.squad ?? []).map((p) => ({
      provider: this.id,
      externalId: String(p.id),
      value: squadPlayer(p),
    }));
  }
}

function squadPlayer(p: NonNullable<FDTeam["squad"]>[number]): ProviderSquadPlayer {
  const parts = p.name.trim().split(/\s+/);
  const nationality = p.nationality ?? "Unknown";
  return {
    externalId: String(p.id),
    name: p.name,
    firstName: parts[0],
    lastName: parts.slice(1).join(" ") || parts[0],
    position: mapPosition(p.position),
    shirtNumber: p.shirtNumber ?? 0,
    nationality,
    nationalityCode: NATIONALITY_CODES[nationality] ?? nationality.slice(0, 3).toUpperCase(),
    dateOfBirth: p.dateOfBirth ?? "1900-01-01",
  };
}

function humanStage(stage: string): string {
  return stage
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function mapPosition(p: string | null): Position {
  const s = (p ?? "").toLowerCase();
  if (s.includes("keeper")) return "GK";
  if (s.includes("mid")) return "MF";
  if (s.includes("back") || s.includes("defen")) return "DF";
  if (
    s.includes("wing") ||
    s.includes("forward") ||
    s.includes("striker") ||
    s.includes("offence") ||
    s.includes("attack")
  )
    return "FW";
  return "MF";
}

function areaCode(code: string): string {
  return (
    {
      ENG: "GB-ENG",
      SCO: "GB-SCT",
      WAL: "GB-WLS",
      ESP: "ES",
      DEU: "DE",
      ITA: "IT",
      FRA: "FR",
      NLD: "NL",
      PRT: "PT",
      BEL: "BE",
      EUR: "EU",
    }[code] ?? code
  );
}

function cityFromAddress(address: string | null): string {
  if (!address) return "";
  // football-data addresses look like "Highbury House 75 Drayton Park London N5 1BU"
  const words = address.replace(/\s+[A-Z0-9]{2,4}\s?[A-Z0-9]{3}$/, "").split(/\s+/);
  return words.slice(-1)[0] ?? "";
}

const COLOR_WORDS: Record<string, string> = {
  red: "#d62828",
  white: "#ffffff",
  blue: "#1d4ed8",
  "sky blue": "#6cabdd",
  "navy blue": "#1c2c5b",
  "royal blue": "#1d4ed8",
  black: "#111111",
  yellow: "#f5c518",
  claret: "#670e36",
  green: "#1b7f3b",
  orange: "#f68b1f",
  purple: "#5b2a86",
  maroon: "#7a263a",
  grey: "#8a8a84",
  gold: "#c9a227",
  amber: "#f5c518",
  garnet: "#a50044",
};

function parseColors(s: string | null): [string | undefined, string | undefined] {
  const words = (s ?? "")
    .toLowerCase()
    .split("/")
    .map((w) => w.trim())
    .filter(Boolean);
  const first = COLOR_WORDS[words[0]] ?? (words[0] ? "#555555" : undefined);
  const second = COLOR_WORDS[words[1]] ?? (words[0] ? "#ffffff" : undefined);
  return [first, second];
}

const NATIONALITY_CODES: Record<string, string> = {
  England: "GB-ENG",
  Scotland: "GB-SCT",
  Wales: "GB-WLS",
  "Northern Ireland": "GB-NIR",
  Ireland: "IE",
  Spain: "ES",
  Germany: "DE",
  Italy: "IT",
  France: "FR",
  Netherlands: "NL",
  Portugal: "PT",
  Belgium: "BE",
  Brazil: "BR",
  Argentina: "AR",
  Uruguay: "UY",
  Colombia: "CO",
  Morocco: "MA",
  Senegal: "SN",
  Nigeria: "NG",
  Egypt: "EG",
  Algeria: "DZ",
  Japan: "JP",
  "South Korea": "KR",
  "Korea Republic": "KR",
  USA: "US",
  "United States": "US",
  Poland: "PL",
  Ukraine: "UA",
  Croatia: "HR",
  Serbia: "RS",
  Denmark: "DK",
  Norway: "NO",
  Sweden: "SE",
  Switzerland: "CH",
  Austria: "AT",
  Turkey: "TR",
  Türkiye: "TR",
  Greece: "GR",
  Czechia: "CZ",
  "Czech Republic": "CZ",
  Hungary: "HU",
  Mexico: "MX",
  Canada: "CA",
  Australia: "AU",
  Ghana: "GH",
  "Ivory Coast": "CI",
  "Côte d'Ivoire": "CI",
  Cameroon: "CM",
  Mali: "ML",
  Ecuador: "EC",
  Chile: "CL",
  Slovakia: "SK",
  Slovenia: "SI",
  Romania: "RO",
  Bulgaria: "BG",
  Finland: "FI",
  Iceland: "IS",
  Georgia: "GE",
  Albania: "AL",
  Kosovo: "XK",
  "Bosnia and Herzegovina": "BA",
  "North Macedonia": "MK",
  Montenegro: "ME",
  Israel: "IL",
  Iran: "IR",
  Paraguay: "PY",
  Peru: "PE",
  Venezuela: "VE",
  Jamaica: "JM",
  "DR Congo": "CD",
  "Congo DR": "CD",
  Guinea: "GN",
  Tunisia: "TN",
  "Burkina Faso": "BF",
  Gabon: "GA",
  "Cape Verde": "CV",
};
