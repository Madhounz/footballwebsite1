import { getRepository, matchesOnDate } from "@/lib/data";
import { daysSince, finishedSince, movementSince } from "@/lib/data/scenarios";
import { isLive } from "@/lib/live-status";
import type { MatchView } from "@/lib/types";

/**
 * GET /api/since?at=<iso>&teams=arsenal,real-madrid
 *
 * What happened since the reader last looked. The list of followed clubs lives
 * on the device and so does the timestamp, so neither can be known here — both
 * arrive with the request and nothing about the visit is stored.
 *
 * Everything returned is arithmetic on results: how many matches ended, how
 * many goals were in them, which clubs the table moved, and what a followed
 * club did. No feed, no editorial, nothing that needs a provider we do not
 * have.
 */
export const dynamic = "force-dynamic";

/** Further back than this and it is not "while you were away", it is a season. */
const MAX_DAYS = 7;
const MAX_TEAMS = 20;
const MOVERS = 3;

function slim(v: MatchView) {
  return {
    slug: v.match.slug,
    kickoff: v.match.kickoff,
    score: v.match.score,
    competition: { id: v.competition.id, color: v.competition.color },
    home: { id: v.home.id, slug: v.home.slug },
    away: { id: v.away.id, slug: v.away.slug },
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const at = new Date(url.searchParams.get("at") ?? "");
  if (Number.isNaN(at.getTime()))
    return Response.json({ error: "at must be a date" }, { status: 400 });
  const now = new Date();
  const earliest = new Date(now.getTime() - MAX_DAYS * 86_400_000);
  const since = at < earliest ? earliest : at;
  const follows = (url.searchParams.get("teams") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_TEAMS);

  const repo = await getRepository();
  const days = daysSince(since, now);
  const views = (await Promise.all(days.map((d) => matchesOnDate(d)))).flat();
  const ended = views.filter((v) => finishedSince(v.match, since));
  const goals = ended.reduce(
    (n, v) => n + (v.match.score?.home ?? 0) + (v.match.score?.away ?? 0),
    0,
  );

  // Only the competitions that actually played need their table replayed.
  const competitionIds = [...new Set(ended.map((v) => v.competition.id))];
  const moves = (
    await Promise.all(
      competitionIds.map(async (id) => {
        const competition = (await repo.listCompetitions()).find((c) => c.id === id);
        if (!competition) return [];
        const [teams, all] = await Promise.all([
          repo.listTeams(id),
          repo.getCompetitionMatches(id),
        ]);
        return movementSince(
          id,
          competition.season,
          teams.map((t) => t.id),
          all.map((v) => v.match),
          since,
        ).map((m) => ({ ...m, competitionId: id }));
      }),
    )
  ).flat();

  const followed = new Set(follows);
  const yours = ended
    .filter((v) => followed.has(v.home.id) || followed.has(v.away.id))
    .map((v) => {
      const teamId = followed.has(v.home.id) ? v.home.id : v.away.id;
      const move = moves.find((m) => m.teamId === teamId);
      return { teamId, match: slim(v), move: move ? { from: move.from, to: move.to } : null };
    });

  // The next thing worth waiting up for: a followed club if they have one on,
  // otherwise whatever kicks off next anywhere.
  const upcoming = views
    .filter((v) => v.match.status === "scheduled" && new Date(v.match.kickoff) > now)
    .sort((a, b) => a.match.kickoff.localeCompare(b.match.kickoff));
  const next =
    upcoming.find((v) => followed.has(v.home.id) || followed.has(v.away.id)) ?? upcoming[0];

  // Crests for everybody the card will name, so it can be a row of clubs
  // rather than a row of sentences. At most a handful of teams.
  const named = new Set<string>([
    ...yours.map((y) => y.teamId),
    ...moves.slice(0, MOVERS * 2).map((m) => m.teamId),
    ...(next ? [next.home.id, next.away.id] : []),
  ]);
  const all = await repo.listTeams();
  const teams = Object.fromEntries(
    all
      .filter((team) => named.has(team.id))
      .map((team) => [
        team.id,
        { code: team.code, colors: team.colors, crestUrl: team.crestUrl ?? null },
      ]),
  );

  return Response.json(
    {
      since: since.toISOString(),
      teams,
      finished: ended.length,
      goals,
      live: views.filter((v) => isLive(v.match)).length,
      yours: yours.slice(0, 4),
      movers: [...moves]
        .sort((a, b) => Math.abs(b.from - b.to) - Math.abs(a.from - a.to))
        .slice(0, MOVERS),
      next: next ? slim(next) : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
