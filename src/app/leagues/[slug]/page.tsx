import { notFound } from "next/navigation";
import { MatchList } from "@/components/MatchList";
import { Section } from "@/components/Section";
import { StandingsTable } from "@/components/StandingsTable";
import { getRepository } from "@/lib/data";

export default async function LeagueTablePage({ params }: { params: Promise<{ slug: string }> }) {
  const repo = await getRepository();
  const c = await repo.getCompetitionBySlug((await params).slug);
  if (!c) notFound();
  const [standings, teams, matches] = await Promise.all([
    repo.getStandings(c.id),
    repo.listTeams(c.id),
    repo.getCompetitionMatches(c.id),
  ]);
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const played = standings.rows.reduce((n, r) => n + r.played, 0) / 2;
  const upcoming = matches.filter(
    (v) => v.match.status === "scheduled" || v.match.status === "live",
  );
  const nextRound = upcoming[0]?.match.round;
  const nextMatches = upcoming.filter((v) => v.match.round === nextRound).slice(0, 10);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <Section
        title={c.kind === "cup" ? "League phase" : "Table"}
        action={
          <span className="tnum">
            {Math.round(played)} of {(c.teamCount * c.rounds) / 2} matches played
          </span>
        }
      >
        <StandingsTable standings={standings} competition={c} teams={teamMap} />
      </Section>
      <div className="space-y-6">
        <Section
          title={nextRound ? `Matchday ${nextRound}` : "Fixtures"}
          action={<a href={`/leagues/${c.slug}/fixtures`}>All fixtures →</a>}
        >
          <MatchList views={nextMatches} competitions={[c]} emptyText="Season complete." />
        </Section>
      </div>
    </div>
  );
}
