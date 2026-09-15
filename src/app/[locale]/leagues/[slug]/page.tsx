import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { MatchList } from "@/components/MatchList";
import { Section } from "@/components/Section";
import { StandingsTable } from "@/components/StandingsTable";
import { getRepository } from "@/lib/data";

export default async function LeagueTablePage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getTranslations("league");
  const tm = await getTranslations("match");
  const repo = await getRepository();
  const c = await repo.getCompetitionBySlug((await params).slug);
  if (!c) notFound();
  const [standings, teams, matches] = await Promise.all([
    repo.getStandings(c.id),
    repo.listTeams(c.id),
    repo.getCompetitionMatches(c.id),
  ]);
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const played = standings.rows.reduce((n, r) => n + r.played, 0) / 2;
  const upcoming = matches.filter(
    (v) => v.match.status === "scheduled" || v.match.status === "live",
  );
  const nextRound = upcoming[0]?.match.round;
  const nextMatches = upcoming.filter((v) => v.match.round === nextRound).slice(0, 10);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <Section
        title={c.kind === "cup" ? t("leaguePhase") : t("table")}
        action={
          <span className="tnum">
            {t("played", { played: Math.round(played), total: (c.teamCount * c.rounds) / 2 })}
          </span>
        }
      >
        <StandingsTable standings={standings} competition={c} teams={teamMap} />
      </Section>
      <div className="min-w-0 space-y-6">
        <Section
          title={nextRound ? tm("matchday", { n: nextRound }) : t("fixtures")}
          action={<Link href={`/leagues/${c.slug}/fixtures`}>{t("allFixtures")}</Link>}
        >
          <MatchList views={nextMatches} competitions={[c]} emptyText={t("seasonComplete")} />
        </Section>
      </div>
    </div>
  );
}
