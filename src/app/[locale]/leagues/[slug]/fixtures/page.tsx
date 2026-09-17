import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { RoundList } from "@/components/RoundList";
import { getRepository } from "@/lib/data";

export default async function FixturesPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getTranslations("league");
  const repo = await getRepository();
  const c = await repo.getCompetitionBySlug((await params).slug);
  if (!c) notFound();
  const all = await repo.getCompetitionMatches(c.id);
  const views = all.filter((v) => v.match.status !== "finished");
  return (
    <RoundList
      views={views}
      competition={c}
      mode="fixtures"
      emptyText={all.length === 0 ? t("noMatchesYet") : undefined}
    />
  );
}
