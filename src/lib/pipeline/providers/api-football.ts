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

/**
 * API-Football v3 — https://www.api-football.com/documentation-v3
 * Second, independent source so every score can be cross-checked.
 */
const BASE = "https://v3.football.api-sports.io";

interface AFFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
    venue: { name: string | null };
    referee: string | null;
  };
  league: { round: string };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}

const STATUS: Record<string, [MatchStatus, ProviderMatch["phase"]]> = {
  TBD: ["scheduled", "NS"],
  NS: ["scheduled", "NS"],
  "1H": ["live", "1H"],
  HT: ["live", "HT"],
  "2H": ["live", "2H"],
  ET: ["live", "ET"],
  BT: ["live", "ET"],
  P: ["live", "PEN"],
  SUSP: ["postponed", "NS"],
  INT: ["live", "2H"],
  FT: ["finished", "FT"],
  AET: ["finished", "ET"],
  PEN: ["finished", "PEN"],
  PST: ["postponed", "NS"],
  CANC: ["cancelled", "NS"],
  ABD: ["postponed", "NS"],
  AWD: ["finished", "FT"],
  WO: ["finished", "FT"],
  LIVE: ["live", "2H"],
};

export interface ApiFootballOptions {
  apiKey: string;
  season: number; // starting year, e.g. 2026 for 2026/27
  knownTeams: { id: string; name: string; shortName: string }[];
  fetchImpl?: typeof fetch;
  onUnknownTeam?: (name: string, externalId: string) => void;
}

export class ApiFootballProvider implements Provider {
  readonly id = "api-football";
  readonly weight = 0.7;
  private fetchImpl: typeof fetch;

  constructor(private readonly opts: ApiFootballOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  supports(competitionId: string): boolean {
    return Boolean(COMPETITION_CODES[competitionId]?.apiFootball);
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetchImpl(`${BASE}${path}`, {
      headers: { "x-apisports-key": this.opts.apiKey },
    });
    if (!res.ok) throw new Error(`api-football ${res.status} for ${path}`);
    const body = (await res.json()) as { response: T; errors?: unknown };
    if (body.errors && Object.keys(body.errors as object).length)
      throw new Error(`api-football: ${JSON.stringify(body.errors)}`);
    return body.response;
  }

  async fetchMatches(
    competition: Competition,
    window: FetchWindow,
  ): Promise<ProviderRecord<ProviderMatch>[]> {
    const league = COMPETITION_CODES[competition.id]?.apiFootball;
    if (!league) return [];
    const fixtures = await this.get<AFFixture[]>(
      `/fixtures?league=${league}&season=${this.opts.season}&from=${window.fromDate}&to=${window.toDate}&timezone=UTC`,
    );
    const out: ProviderRecord<ProviderMatch>[] = [];
    for (const f of fixtures) {
      const home = resolveTeamId(f.teams.home.name, this.opts.knownTeams);
      const away = resolveTeamId(f.teams.away.name, this.opts.knownTeams);
      if (!home) this.opts.onUnknownTeam?.(f.teams.home.name, String(f.teams.home.id));
      if (!away) this.opts.onUnknownTeam?.(f.teams.away.name, String(f.teams.away.id));
      if (!home || !away) continue;
      const [status, phase] = STATUS[f.fixture.status.short] ?? ["scheduled", "NS"];
      const round = Number(/(\d+)\s*$/.exec(f.league.round)?.[1] ?? 0);
      out.push({
        provider: this.id,
        externalId: String(f.fixture.id),
        value: {
          id: "",
          competitionId: competition.id,
          round,
          stage: competition.kind === "cup" ? f.league.round.replace(/\s*-\s*\d+$/, "") : undefined,
          kickoff: new Date(f.fixture.date).toISOString(),
          homeTeamId: home,
          awayTeamId: away,
          status,
          phase,
          minute: f.fixture.status.elapsed,
          score:
            f.goals.home != null && f.goals.away != null
              ? { home: f.goals.home, away: f.goals.away }
              : null,
          halfTimeScore:
            f.score.halftime.home != null && f.score.halftime.away != null
              ? { home: f.score.halftime.home, away: f.score.halftime.away }
              : null,
          venue: f.fixture.venue.name ?? undefined,
          referee: f.fixture.referee ?? undefined,
        },
      });
    }
    return out;
  }

  async fetchTeams(): Promise<ProviderRecord<ProviderTeam>[]> {
    // Team metadata is taken from football-data; API-Football is used for cross-checking results.
    return [];
  }

  async fetchSquad(): Promise<ProviderRecord<ProviderSquadPlayer>[]> {
    return [];
  }
}
