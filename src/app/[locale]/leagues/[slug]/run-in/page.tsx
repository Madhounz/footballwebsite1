import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { RunInTable, RunList } from "@/components/RunInTable";
import { Empty, Section } from "@/components/Section";
import { getRepository } from "@/lib/data";
import { runIn, undecided } from "@/lib/data/run-in";

/**
 * What is left of the season, and what the table can still do about it.
 *
 * Everything here is arithmetic on the table and the fixture list — no model,
 * no forecast, nothing a result can overturn. It works from the first week
 * with a free provider plan, and it is at its best in May.
 */
const SHOWN = 5;

export default async function RunInPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getTranslations("league");
  const repo = await getRepository();
  const c = await repo.getCompetitionBySlug((await params).slug);
  if (!c) notFound();
  const [standings, teamList, views] = await Promise.all([
    repo.getStandings(c.id),
    repo.listTeams(c.id),
    repo.getCompetitionMatches(c.id),
  ]);
  const teams = new Map(teamList.map((team) => [team.id, team]));
  const rows = runIn(
    standings.rows,
    views.map((v) => v.match),
    c.rounds,
  );
  if (rows.length === 0 || standings.rows.every((r) => r.played === 0))
    return <Empty>{t("noTableYet")}</Empty>;

  const withFixtures = rows.filter((r) => r.difficulty !== null);
  const hardest = [...withFixtures].sort((a, b) => a.difficulty! - b.difficulty!).slice(0, SHOWN);
  const easiest = [...withFixtures].sort((a, b) => b.difficulty! - a.difficulty!).slice(0, SHOWN);

  return (
    <div className="space-y-8">
      <Section title={t("runInTitle")}>
        <p className="max-w-2xl text-sm text-muted">{t("runInLead")}</p>
        <RunInTable rows={rows} teams={teams} competition={c} />
        <p className="mt-2 max-w-2xl text-xs text-faint">
          {undecided(rows) ? t("runInEarly") : t("runInBound")}
        </p>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t("runInHardest")}>
          <RunList rows={hardest} teams={teams} empty={t("runInOver")} />
        </Section>
        <Section title={t("runInEasiest")}>
          <RunList rows={easiest} teams={teams} empty={t("runInOver")} />
        </Section>
      </div>
      <p className="text-xs text-faint">{t("runInDifficultyNote")}</p>
    </div>
  );
}
