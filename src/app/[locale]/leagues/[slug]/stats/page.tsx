import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ScorersTable } from "@/components/ScorersTable";
import { Section } from "@/components/Section";
import { getRepository } from "@/lib/data";
import type { Player } from "@/lib/types";

export default async function StatsPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getTranslations("league");
  const repo = await getRepository();
  const c = await repo.getCompetitionBySlug((await params).slug);
  if (!c) notFound();
  const [rows, teams] = await Promise.all([repo.getTopScorers(c.id, 25), repo.listTeams(c.id)]);
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const players = new Map<string, Player>();
  await Promise.all(
    [...new Set(rows.map((r) => r.teamId))].map(async (teamId) => {
      for (const p of await repo.getSquad(teamId)) players.set(p.id, p);
    }),
  );
  const assists = [...rows]
    .sort((a, b) => b.assists - a.assists || b.goals - a.goals)
    .filter((r) => r.assists > 0)
    .slice(0, 10);
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <Section title={t("topScorers")}>
        <ScorersTable rows={rows} players={players} teams={teamMap} />
      </Section>
      <Section title={t("mostAssists")}>
        <ScorersTable rows={assists} players={players} teams={teamMap} compact />
      </Section>
    </div>
  );
}
