import { getRepository } from "@/lib/data";
import { isISODate, todayISO } from "@/lib/dates";

/** GET /api/matches?date=YYYY-MM-DD — matches for a day, grouped by competition. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? todayISO();
  if (!isISODate(date)) return Response.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  const repo = await getRepository();
  const views = await repo.getMatchesOnDate(date);
  return Response.json(
    {
      date,
      count: views.length,
      matches: views.map((v) => ({
        id: v.match.id,
        competition: { id: v.competition.id, name: v.competition.name },
        kickoff: v.match.kickoff,
        status: v.match.status,
        minute: v.match.minute,
        home: { id: v.home.id, name: v.home.name },
        away: { id: v.away.id, name: v.away.name },
        score: v.match.score,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
}
