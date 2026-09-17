import { getRepository } from "@/lib/data";
import { runIn } from "@/lib/data/run-in";
import type { MatchView } from "@/lib/types";

/**
 * GET /api/following?teams=arsenal,real-madrid[&detail=1]
 *
 * What each followed club is doing: the match in progress or next to come, and
 * the last result. The list of clubs lives on the device, so the page cannot be
 * rendered with it on the server — it asks for this instead, once, after the
 * first paint.
 *
 * `detail=1` adds the league row, the form guide and the range of places the
 * club can still finish in. It costs a table per competition, so the strip on
 * the home page does not ask for it and the page built entirely out of it
 * does. Each competition is read once however many followed clubs are in it.
 */
export const dynamic = "force-dynamic";

/** Enough clubs for anyone, few enough that one request stays cheap. */
const MAX_TEAMS = 20;

function slim(v: MatchView) {
  return {
    slug: v.match.slug,
    kickoff: v.match.kickoff,
    status: v.match.status,
    minute: v.match.minute,
    phase: v.match.phase,
    score: v.match.score,
    competition: { id: v.competition.id, color: v.competition.color },
    home: { id: v.home.id, slug: v.home.slug, crestUrl: v.home.crestUrl ?? null },
    away: { id: v.away.id, slug: v.away.slug, crestUrl: v.away.crestUrl ?? null },
  };
}

/**
 * The league row and the still-possible range for every club in each of the
 * given competitions, computed once per competition.
 */
async function tables(competitionIds: string[]) {
  const repo = await getRepository();
  const known = new Map((await repo.listCompetitions()).map((c) => [c.id, c]));
  const out = new Map<
    string,
    {
      id: string;
      slug: string;
      color: string;
      places: number;
      rows: Map<
        string,
        {
          position: number;
          played: number;
          points: number;
          goalDifference: number;
          movement: number;
          form: string[];
          best: number;
          worst: number;
        }
      >;
    }
  >();
  await Promise.all(
    competitionIds.filter(Boolean).map(async (competitionId) => {
      const competition = known.get(competitionId);
      if (!competition) return;
      const [standings, views] = await Promise.all([
        repo.getStandings(competitionId),
        repo.getCompetitionMatches(competitionId),
      ]);
      const ranges = new Map(
        runIn(
          standings.rows,
          views.map((v) => v.match),
          competition.rounds,
        ).map((r) => [r.teamId, r]),
      );
      out.set(competitionId, {
        id: competition.id,
        slug: competition.slug,
        color: competition.color,
        places: standings.rows.length,
        rows: new Map(
          standings.rows.map((r) => [
            r.teamId,
            {
              position: r.position,
              played: r.played,
              points: r.points,
              goalDifference: r.goalDifference,
              movement: r.movement,
              form: r.form,
              best: ranges.get(r.teamId)?.best ?? 1,
              worst: ranges.get(r.teamId)?.worst ?? standings.rows.length,
            },
          ]),
        ),
      });
    }),
  );
  return out;
}

export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("teams") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_TEAMS);
  if (ids.length === 0) return Response.json({ teams: [] });

  const detail = new URL(req.url).searchParams.get("detail") === "1";
  const repo = await getRepository();
  const found = (await Promise.all(ids.map((id) => repo.getTeamById(id)))).filter(
    (t) => t !== null,
  );
  // One table per competition, not one per club: six followed clubs in the
  // same league would otherwise compute the same table six times.
  const leagues = detail
    ? await tables([...new Set(found.map((t) => t.leagueId ?? "").filter(Boolean))])
    : null;

  const teams = await Promise.all(
    found.map(async (team) => {
      const matches = await repo.getTeamMatches(team.id);
      // Sorted by kickoff, so the next match is the first that has not finished.
      const upcoming = matches.find((v) => v.match.status !== "finished");
      const last = [...matches].reverse().find((v) => v.match.status === "finished");
      const league = team.leagueId ? leagues?.get(team.leagueId) : undefined;
      const row = league?.rows.get(team.id);
      return {
        id: team.id,
        slug: team.slug,
        name: team.name,
        shortName: team.shortName,
        code: team.code,
        colors: team.colors,
        crestUrl: team.crestUrl ?? null,
        next: upcoming ? slim(upcoming) : null,
        last: last ? slim(last) : null,
        ...(league && row
          ? {
              league: {
                id: league.id,
                slug: league.slug,
                color: league.color,
                places: league.places,
              },
              standing: {
                position: row.position,
                played: row.played,
                points: row.points,
                goalDifference: row.goalDifference,
                movement: row.movement,
                form: row.form,
                best: row.best,
                worst: row.worst,
              },
            }
          : {}),
      };
    }),
  );
  return Response.json(
    { teams },
    // Short enough to follow a live score, long enough to cost nothing.
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
}
