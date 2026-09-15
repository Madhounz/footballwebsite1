import { getRepository } from "@/lib/data";

export async function GET() {
  const repo = await getRepository();
  const views = await repo.getLiveMatches();
  return Response.json(
    views.map((v) => ({
      id: v.match.id,
      competition: v.competition.shortName,
      minute: v.match.minute,
      phase: v.match.phase,
      home: v.home.shortName,
      away: v.away.shortName,
      score: v.match.score,
    })),
    { headers: { "Cache-Control": "no-store" } },
  );
}
