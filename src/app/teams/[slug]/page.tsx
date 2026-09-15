import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormBadges } from "@/components/Form";
import { LocalTime } from "@/components/LocalTime";
import { MatchRow } from "@/components/MatchRow";
import { Empty, Section, Stat } from "@/components/Section";
import { StandingsTable } from "@/components/StandingsTable";
import { TeamCrest } from "@/components/TeamCrest";
import { getRepository } from "@/lib/data";
import { ageFromDOB } from "@/lib/dates";
import { ordinal, positionLabel } from "@/lib/format";
import type { Position } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const repo = await getRepository();
  const t = await repo.getTeamBySlug((await params).slug);
  return t
    ? {
        title: t.name,
        description: `${t.name}: fixtures, results, squad, table position and honours.`,
      }
    : {};
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const repo = await getRepository();
  const team = await repo.getTeamBySlug((await params).slug);
  if (!team) notFound();
  const [matches, squad, honours, competitions] = await Promise.all([
    repo.getTeamMatches(team.id),
    repo.getSquad(team.id),
    repo.getTeamHonours(team.id),
    repo.listCompetitions(),
  ]);
  const league = team.leagueId ? competitions.find((c) => c.id === team.leagueId) : undefined;
  const standings = league ? await repo.getStandings(league.id) : null;
  const leagueTeams = league
    ? new Map((await repo.listTeams(league.id)).map((t) => [t.id, t]))
    : new Map();
  const row = standings?.rows.find((r) => r.teamId === team.id);

  const live = matches.find((v) => v.match.status === "live");
  const results = matches
    .filter((v) => v.match.status === "finished")
    .slice(-5)
    .reverse();
  const upcoming = matches.filter((v) => v.match.status === "scheduled").slice(0, 5);
  const next = live ?? upcoming[0];

  const byPos: Record<Position, typeof squad> = { GK: [], DF: [], MF: [], FW: [] };
  for (const p of squad) byPos[p.position].push(p);

  // Table slice around the team
  const slice =
    standings && row ? standings.rows.slice(Math.max(0, row.position - 3), row.position + 2) : [];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center gap-4">
        <TeamCrest team={team} size={64} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-faint">
            {team.city}, {team.country} · est. {team.founded}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{team.name}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <span>{team.stadium}</span>
            {team.manager && <span>Manager: {team.manager}</span>}
            <span className="flex flex-wrap gap-1">
              {team.competitionIds.map((id) => {
                const c = competitions.find((x) => x.id === id);
                return c ? (
                  <Link
                    key={id}
                    href={`/leagues/${c.slug}`}
                    className="rounded-full border border-line px-2 py-0.5 text-xs hover:bg-surface-2"
                  >
                    {c.shortName}
                  </Link>
                ) : null;
              })}
            </span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={league ? `${league.shortName} position` : "League"}
          value={row ? ordinal(row.position) : "—"}
          hint={row ? `${row.points} pts from ${row.played}` : "Not in a tracked league"}
        />
        <Stat label="Form" value={row ? <FormBadges form={row.form} size="md" /> : "—"} />
        <Stat
          label="Goals"
          value={row ? `${row.goalsFor}:${row.goalsAgainst}` : "—"}
          hint={
            row
              ? `${row.goalDifference >= 0 ? "+" : ""}${row.goalDifference} difference`
              : undefined
          }
        />
        <Stat
          label={live ? "Now" : "Next match"}
          value={
            next ? (
              live ? (
                `${live.match.score?.home}–${live.match.score?.away}`
              ) : (
                <LocalTime iso={next.match.kickoff} withDate className="text-base" />
              )
            ) : (
              "—"
            )
          }
          hint={
            next
              ? `${next.home.id === team.id ? "vs" : "at"} ${next.home.id === team.id ? next.away.shortName : next.home.shortName}`
              : undefined
          }
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Recent results" action={<Link href={`#all-matches`}>All →</Link>}>
          {results.length ? (
            <div className="card divide-y divide-line overflow-hidden">
              {results.map((v) => (
                <MatchRow key={v.match.id} view={v} showRound />
              ))}
            </div>
          ) : (
            <Empty>No results yet.</Empty>
          )}
        </Section>
        <Section title="Upcoming">
          {live || upcoming.length ? (
            <div className="card divide-y divide-line overflow-hidden">
              {[...(live ? [live] : []), ...upcoming].map((v) => (
                <MatchRow key={v.match.id} view={v} showRound />
              ))}
            </div>
          ) : (
            <Empty>No fixtures scheduled.</Empty>
          )}
        </Section>
      </div>

      {standings && league && slice.length > 0 && (
        <Section
          title={`${league.name} — around ${team.shortName}`}
          action={<Link href={`/leagues/${league.slug}`}>Full table →</Link>}
        >
          <StandingsTable
            standings={{ ...standings, rows: slice }}
            competition={league}
            teams={leagueTeams}
            highlightTeamId={team.id}
            compact
          />
        </Section>
      )}

      <Section title="Squad" action={<span>{squad.length} players</span>}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(["GK", "DF", "MF", "FW"] as Position[]).map((pos) => (
            <div key={pos} className="card overflow-hidden">
              <div className="border-b border-line px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
                {positionLabel(pos)}s
              </div>
              <ul className="divide-y divide-line">
                {byPos[pos].map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/players/${p.slug}`}
                      className="row-hover tnum flex items-center gap-3 px-4 py-2 text-sm"
                    >
                      <span className="w-6 text-end text-faint">{p.shirtNumber}</span>
                      <span className="flex-1 truncate font-medium">{p.name}</span>
                      <span className="text-xs text-muted">
                        {p.nationalityCode.replace("GB-", "")}
                      </span>
                      <span className="w-6 text-end text-xs text-faint">
                        {ageFromDOB(p.dateOfBirth)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Honours">
        {honours.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {honours.map((h) => (
              <div key={h.competition.id} className="card px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{h.competition.name}</span>
                  <span className="tnum text-xl font-semibold">{h.seasons.length}</span>
                </div>
                <div className="mt-1 text-xs leading-relaxed text-muted">
                  {h.seasons.join(", ")}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty>No titles in the tracked competitions since records here begin.</Empty>
        )}
      </Section>

      <Section title="All matches this season" id="all-matches">
        <div className="card divide-y divide-line overflow-hidden">
          {matches.map((v) => (
            <MatchRow key={v.match.id} view={v} showRound />
          ))}
        </div>
      </Section>
    </div>
  );
}
