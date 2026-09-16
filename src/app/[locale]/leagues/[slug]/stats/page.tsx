import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ScorersTable } from "@/components/ScorersTable";
import { SeasonFacts } from "@/components/SeasonFacts";
import { Section } from "@/components/Section";
import { getRepository } from "@/lib/data";
import { seasonFacts } from "@/lib/data/season-facts";
import { dateOf, formatMediumDate } from "@/lib/dates";
import type { Player } from "@/lib/types";

/**
 * How much of the scorer chart the page reads. It is one stored query either
 * way, and the assists list is only as complete as this is deep.
 */
const CHART_DEPTH = 100;

export default async function StatsPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getTranslations("league");
  const locale = await getLocale();
  const repo = await getRepository();
  const c = await repo.getCompetitionBySlug((await params).slug);
  if (!c) notFound();
  const [chart, teams, matches, standings] = await Promise.all([
    // The whole stored chart. The scorers table shows the front of it; the
    // assists list below is a re-sort of all of it, and at thirty rows that
    // list was the top scorers' assists rather than the competition's.
    repo.getTopScorers(c.id, CHART_DEPTH),
    repo.listTeams(c.id),
    repo.getCompetitionMatches(c.id),
    repo.getStandings(c.id),
  ]);
  const facts = seasonFacts(matches, standings.rows);
  const rows = chart.rows.slice(0, 25);
  // Drawn from the scorer chart, which the provider orders by goals: a player
  // with eight assists and no goals is not in it and so cannot appear here.
  // The whole chart is used rather than the 25 shown above, and the page says
  // what the list is, because "Most assists" on its own is a claim we cannot
  // make on this plan.
  const assists = [...chart.rows]
    .sort((a, b) => b.assists - a.assists || b.goals - a.goals)
    .filter((r) => r.assists > 0)
    .slice(0, 10);
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const players = new Map<string, Player>();
  // Both lists, not just the scorers: the table drops a row whose player it
  // cannot name, so a squad left unloaded here would take the assist leader
  // off the list rather than show him without a name.
  await Promise.all(
    [...new Set([...rows, ...assists].map((r) => r.teamId))].map(async (teamId) => {
      for (const p of await repo.getSquad(teamId)) players.set(p.id, p);
    }),
  );
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
