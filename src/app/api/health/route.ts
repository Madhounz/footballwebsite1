import { getRepository } from "@/lib/data";

export async function GET() {
  const repo = await getRepository();
  const live = await repo.getLiveMatches();
  return Response.json({
    ok: true,
    source: repo.info().kind,
    live: live.length,
    time: new Date().toISOString(),
  });
}
