import { notFound } from "next/navigation";
import { RoundList } from "@/components/RoundList";
import { getRepository } from "@/lib/data";

export default async function ResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const repo = await getRepository();
  const c = await repo.getCompetitionBySlug((await params).slug);
  if (!c) notFound();
  const views = (await repo.getCompetitionMatches(c.id))
    .filter((v) => v.match.status === "finished")
    .reverse();
  return <RoundList views={views} competition={c} mode="results" />;
}
