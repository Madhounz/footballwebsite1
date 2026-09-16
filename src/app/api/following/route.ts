import { getRepository } from "@/lib/data";
import type { MatchView } from "@/lib/types";

/**
 * GET /api/following?teams=arsenal,real-madrid
 *
 * What each followed club is doing: the match in progress or next to come, and
 * the last result. The list of clubs lives on the device, so the page cannot be
 * rendered with it on the server — it asks for this instead, once, after the
 * first paint.
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

export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("teams") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_TEAMS);
  if (ids.length === 0) return Response.json({ teams: [] });

  const repo = await getRepository();
  const teams = await Promise.all(
    ids.map(async (id) => {
      const team = await repo.getTeamById(id);
      if (!team) return null;
      const matches = await repo.getTeamMatches(id);
      // Sorted by kickoff, so the next match is the first that has not finished.
      const upcoming = matches.find((v) => v.match.status !== "finished");
      const last = [...matches].reverse().find((v) => v.match.status === "finished");
      return {
        id: team.id,
        slug: team.slug,
        name: team.name,
        shortName: team.shortName,
        colors: team.colors,
        crestUrl: team.crestUrl ?? null,
        next: upcoming ? slim(upcoming) : null,
        last: last ? slim(last) : null,
      };
    }),
  );
  return Response.json(
    { teams: teams.filter(Boolean) },
    // Short enough to follow a live score, long enough to cost nothing.
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
}
