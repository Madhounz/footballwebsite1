import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ScorersTable } from "@/components/ScorersTable";
import { SeasonFacts } from "@/components/SeasonFacts";
import { Section } from "@/components/Section";
import { getRepository } from "@/lib/data";
import { seasonFacts } from "@/lib/data/season-facts";
import { dateOf, formatMediumDate } from "@/lib/dates";
import type { Player } from "@/lib/types";

export default async function StatsPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getTranslations("league");
  const locale = await getLocale();
  const repo = await getRepository();
  const c = await repo.getCompetitionBySlug((await params).slug);
  if (!c) notFound();
  const [chart, teams, matches, standings] = await Promise.all([
    repo.getTopScorers(c.id, 30),
    repo.listTeams(c.id),
    repo.getCompetitionMatches(c.id),
    repo.getStandings(c.id),
  ]);
  const facts = seasonFacts(matches, standings.rows);
  // The whole stored chart, so the assists list below is drawn from all of it;
  // the scorers table itself stays the length it was.
  const rows = chart.rows.slice(0, 25);
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const players = new Map<string, Player>();
  await Promise.all(
    [...new Set(rows.map((r) => r.teamId))].map(async (teamId) => {
      for (const p of await repo.getSquad(teamId)) players.set(p.id, p);
    }),
  );
  // Drawn from the scorer chart, which the provider orders by goals: a player
  // with eight assists and no goals is not in it and so cannot appear here.
  // The whole chart is used rather than the 25 shown above, and the page says
  // what the list is, because "Most assists" on its own is a claim we cannot
  // make on this plan.
  const assists = [...chart.rows]
    .sort((a, b) => b.assists - a.assists || b.goals - a.goals)
    .filter((r) => r.assists > 0)
    .slice(0, 10);
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <Section title={t("topScorers")}>
        <ScorersTable rows={rows} players={players} teams={teamMap} />
        {/*
          Say which chart this is. The demo season is self-contained, so its
          own count is the whole truth and needs no caveat.
        */}
        {chart.source === "provider" ? (
          <p className="mt-2 text-xs text-faint">
            {t("scorersProvider", {
              date: formatMediumDate(dateOf(chart.updatedAt ?? ""), locale),
            })}
          </p>
        ) : (
          repo.info().kind === "db" && (
            <p className="mt-2 text-xs text-faint">{t("scorersCounted")}</p>
          )
        )}
      </Section>
      <div className="min-w-0 space-y-8">
        <Section title={t("seasonSoFar")}>
          <SeasonFacts facts={facts} teams={teamMap} />
        </Section>
        <Section title={t("mostAssists")}>
          <ScorersTable rows={assists} players={players} teams={teamMap} compact rankBy="assists" />
          {chart.source === "provider" && (
            <p className="mt-2 text-xs text-faint">{t("assistsFromScorers")}</p>
          )}
        </Section>
      </div>
    </div>
  );
}
