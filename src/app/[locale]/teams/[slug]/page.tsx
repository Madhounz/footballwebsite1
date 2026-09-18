import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { FormBadges } from "@/components/Form";
import { LocalTime } from "@/components/LocalTime";
import { MatchRow } from "@/components/MatchRow";
import { Empty, Section, Stat } from "@/components/Section";
import { Score } from "@/components/Score";
import { SeasonArc } from "@/components/SeasonArc";
import { StandingsTable } from "@/components/StandingsTable";
import { TeamCrest } from "@/components/TeamCrest";
import { FollowButton } from "@/components/FollowButton";
import { getRepository } from "@/lib/data";
import { arcExtremes, seasonArc } from "@/lib/data/season-arc";
import { pageMeta } from "@/lib/seo";
import { ageFromDOB } from "@/lib/dates";
import { ordinal, signed } from "@/lib/format";
import {
  competitionName,
  competitionShortName,
  countryName,
  teamName,
  teamShortName,
} from "@/lib/i18n/names";
import type { Position } from "@/lib/types";
import { isLive } from "@/lib/live-status";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const repo = await getRepository();
  const team = await repo.getTeamBySlug(slug);
  if (!team) return {};
  const t = await getTranslations({ locale, namespace: "team" });
  const name = teamName(team, locale);
  return pageMeta({
    locale,
    path: `/teams/${team.slug}`,
    title: name,
    description: t("description", { name }),
  });
}

export default async function TeamPage({ params }: { params: Params }) {
  const t = await getTranslations("team");
  const tm = await getTranslations("match");
  const tp = await getTranslations("positions");
  const locale = await getLocale();
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
    ? new Map((await repo.listTeams(league.id)).map((x) => [x.id, x]))
    : new Map();
  const row = standings?.rows.find((r) => r.teamId === team.id);
  // Where they have been all season, from the same scorelines as the table.
  // A club with no league of their own — a European side we hold only for the
  // matches they play against ours — has no line to draw.
  const arc = league
    ? seasonArc(
        league.id,
        league.season,
        [...leagueTeams.keys()],
        (await repo.getCompetitionMatches(league.id)).map((v) => v.match),
        team.id,
      )
    : [];
  const extremes = arcExtremes(arc);

  const live = matches.find((v) => isLive(v.match));
  const results = matches
    .filter((v) => v.match.status === "finished")
    .slice(-5)
    .reverse();
  const upcoming = matches.filter((v) => v.match.status === "scheduled").slice(0, 5);
  const next = live ?? upcoming[0];

  const byPos: Record<Position, typeof squad> = { GK: [], DF: [], MF: [], FW: [] };
  for (const p of squad) byPos[p.position].push(p);
  const slice =
    standings && row ? standings.rows.slice(Math.max(0, row.position - 3), row.position + 2) : [];
  const name = teamName(team, locale);
  const leagueName = league ? competitionName(league, locale) : "";
  const isArabic = locale === "ar";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center gap-4">
        <TeamCrest team={team} size={64} />
        <div className="min-w-0 flex-1 space-y-1">
          {/* Built from the parts we actually have: a club with no city on
              record gets a line about its country, not a line starting with a
              comma. */}
          <div className="text-xs font-medium uppercase tracking-wide text-faint">
            {[
              [team.city, countryName(team.countryCode, locale, team.country)]
                .filter(Boolean)
                .join(", "),
              team.founded ? t("est", { year: team.founded }) : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{name}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {team.stadium && <span>{team.stadium}</span>}
            {team.manager && <span>{t("manager", { name: team.manager })}</span>}
            <span className="flex flex-wrap gap-1">
              {team.competitionIds.map((id) => {
                const c = competitions.find((x) => x.id === id);
                return c ? (
                  <Link
                    key={id}
                    href={`/leagues/${c.slug}`}
                    className="rounded-full border border-line px-2 py-0.5 text-xs hover:bg-surface-2"
                  >
                    {competitionShortName(c, locale)}
                  </Link>
                ) : null;
              })}
            </span>
          </div>
        </div>
        <FollowButton teamId={team.id} name={name} />
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={
            league ? t("position", { league: competitionShortName(league, locale) }) : t("league")
          }
          value={row ? (isArabic ? row.position : ordinal(row.position)) : "—"}
          hint={row ? t("ptsFrom", { points: row.points, played: row.played }) : t("notTracked")}
        />
        <Stat label={t("form")} value={row ? <FormBadges form={row.form} size="md" /> : "—"} />
        <Stat
          label={t("goals")}
          value={row ? <span dir="ltr">{`${row.goalsFor}:${row.goalsAgainst}`}</span> : "—"}
          hint={row ? t("difference", { gd: signed(row.goalDifference) }) : undefined}
        />
        <Stat
          label={live ? t("now") : t("nextMatch")}
          value={
            next ? (
              live ? (
                <Score home={live.match.score?.home ?? 0} away={live.match.score?.away ?? 0} />
              ) : (
                <LocalTime iso={next.match.kickoff} withDate className="text-base" />
              )
            ) : (
              "—"
            )
          }
          hint={
            next
              ? `${next.home.id === team.id ? tm("vs") : tm("at")} ${teamShortName(next.home.id === team.id ? next.away : next.home, locale)}`
              : undefined
          }
        />
      </div>

      {league && extremes && arc.length >= 3 && (
        <Section
          title={t("arcTitle")}
          action={
            <span className="tnum">
              {t("arcSummary", {
                best: isArabic ? extremes.best : ordinal(extremes.best),
                worst: isArabic ? extremes.worst : ordinal(extremes.worst),
              })}
            </span>
          }
        >
          <SeasonArc points={arc} team={team} competition={league} />
        </Section>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title={t("recent")} action={<a href="#all-matches">{t("all")}</a>}>
          {results.length ? (
            <div className="card divide-y divide-line overflow-hidden">
              {results.map((v) => (
                <MatchRow key={v.match.id} view={v} showRound />
              ))}
            </div>
          ) : (
            <Empty>{t("noFixtures")}</Empty>
          )}
        </Section>
        <Section title={t("upcoming")}>
          {live || upcoming.length ? (
            <div className="card divide-y divide-line overflow-hidden">
              {[...(live ? [live] : []), ...upcoming].map((v) => (
                <MatchRow key={v.match.id} view={v} showRound />
              ))}
            </div>
          ) : (
            <Empty>{t("noFixtures")}</Empty>
          )}
        </Section>
      </div>

      {standings && league && slice.length > 0 && (
        <Section
          title={t("around", { league: leagueName, team: teamShortName(team, locale) })}
          action={<Link href={`/leagues/${league.slug}`}>{t("all")}</Link>}
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

      <Section title={t("squad")} action={<span>{t("players", { n: squad.length })}</span>}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(["GK", "DF", "MF", "FW"] as Position[]).map((pos) => (
            <div key={pos} className="card overflow-hidden">
              <div className="border-b border-line px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
                {tp(`${pos}s`)}
              </div>
              <ul className="divide-y divide-line">
                {byPos[pos].map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/players/${p.slug}`}
                      className="row-hover tnum flex items-center gap-3 px-4 py-2 text-sm"
                    >
                      <span className="w-6 text-end text-faint">{p.shirtNumber || ""}</span>
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

      <Section title={t("honours")}>
        {honours.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {honours.map((h) => (
              <div key={h.competition.id} className="card px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{competitionName(h.competition, locale)}</span>
                  <span className="tnum text-xl font-semibold">{h.seasons.length}</span>
                </div>
                <div className="mt-1 text-xs leading-relaxed text-muted" dir="ltr">
                  {h.seasons.join(", ")}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty>{t("noHonours")}</Empty>
        )}
      </Section>

      <Section title={t("allMatches")} id="all-matches">
        <div className="card divide-y divide-line overflow-hidden">
          {matches.map((v) => (
            <MatchRow key={v.match.id} view={v} showRound />
          ))}
        </div>
      </Section>
    </div>
  );
}
