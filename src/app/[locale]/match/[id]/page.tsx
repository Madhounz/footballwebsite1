import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link, permanentRedirect } from "@/i18n/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { EventTimeline } from "@/components/EventTimeline";
import { LineupPitch } from "@/components/LineupPitch";
import { LocalTime } from "@/components/LocalTime";
import { MatchBuildUp } from "@/components/MatchBuildUp";
import { MatchRow } from "@/components/MatchRow";
import { Empty, Section } from "@/components/Section";
import { Score } from "@/components/Score";
import { StageLabel } from "@/components/StageLabel";
import { WhyItMatters } from "@/components/WhyItMatters";
import { TeamCrest } from "@/components/TeamCrest";
import { getRepository } from "@/lib/data";
import { buildMatchContext } from "@/lib/data/match-context";
import { parseMatchRef } from "@/lib/data/match-lookup";
import { stakes } from "@/lib/data/scenarios";
import { whyItMatters } from "@/lib/data/why";
import { pageMeta } from "@/lib/seo";
import { livePhaseLabel } from "@/lib/format";
import { isLive, isStaleLive } from "@/lib/live-status";
import { dateOf, daysBetween, formatMediumDate } from "@/lib/dates";
import { competitionName, teamName, teamShortName } from "@/lib/i18n/names";
import type { Team } from "@/lib/types";

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, id } = await params;
  const repo = await getRepository();
  const d = await repo.getMatch(id);
  if (!d) return {};
  const { match: m, home, away, competition } = d.view;
  const score = m.score ? `${m.score.home}–${m.score.away}` : "v";
  // While it is being played the tab is the scoreboard: the page refreshes
  // itself every twenty seconds, and the title comes back with it.
  const clock = isLive(m) ? (m.phase === "HT" ? "HT" : m.minute != null ? `${m.minute}′` : "") : "";
  const t = await getTranslations({ locale, namespace: "match" });
  return pageMeta({
    locale,
    path: `/match/${m.slug}`,
    title:
      `${teamShortName(home, locale)} ${score} ${teamShortName(away, locale)}${clock ? ` ${clock}` : ""}`.trim(),
    description: t("metaDescription", {
      home: teamName(home, locale),
      away: teamName(away, locale),
      competition: competitionName(competition, locale),
      date: formatMediumDate(dateOf(m.kickoff), locale),
    }),
  });
}

/**
 * A match link published under a name we no longer write.
 *
 * The slug shape is allowed to improve; the links people have already pasted
 * into group chats and the ones search engines have indexed are not allowed to
 * die for it. Anything that names two clubs we hold is read, the match is
 * found, and the reader is sent to the address it lives at now — permanently,
 * so a crawler updates its index rather than asking again every week.
 *
 * It never guesses: a URL that could mean two different matches 404s, because
 * sending somebody to the wrong match is worse than admitting we lost the
 * right one.
 */
async function byOldLink(id: string, locale: string): Promise<null> {
  const repo = await getRepository();
  const teams = await repo.listTeams();
  const ref = parseMatchRef(
    id,
    teams.map((team) => team.id),
  );
  if (!ref) return null;
  const candidates = (await repo.getTeamMatches(ref.a)).filter(
    (v) =>
      (v.home.id === ref.a && v.away.id === ref.b) || (v.home.id === ref.b && v.away.id === ref.a),
  );
  // The date in an old link is a hint, not a key: a kickoff late in the
  // evening is already tomorrow somewhere, and a fixture gets moved. The
  // meeting closest to the date asked for is the one meant. With no date at
  // all, the last one played — or the next, if they have not met yet.
  const found = ref.date
    ? candidates.reduce<(typeof candidates)[number] | null>((best, v) => {
        const gap = Math.abs(daysBetween(ref.date!, dateOf(v.match.kickoff)));
        const bestGap = best ? Math.abs(daysBetween(ref.date!, dateOf(best.match.kickoff))) : 1e9;
        return gap < bestGap ? v : best;
      }, null)
    : ([...candidates].reverse().find((v) => v.match.status === "finished") ?? candidates[0]);
  if (!found) return null;
  // Through the locale-aware helper: English lives at the bare path, so a
  // hand-built "/en/..." would be a permanent redirect to another redirect.
  permanentRedirect({ href: `/match/${found.match.slug}`, locale });
  // `permanentRedirect` throws; this is here so the signature reads honestly.
  return null;
}

export default async function MatchPage({ params }: { params: Params }) {
  const t = await getTranslations("match");
  const locale = await getLocale();
  const repo = await getRepository();
  const { id } = await params;
  const detail = (await repo.getMatch(id)) ?? (await byOldLink(id, locale));
  if (!detail) notFound();
  const { view, events, lineups, players } = detail;
  const { match: m, home, away, competition } = view;
  // A record left saying "live" after an abandonment is not a match in play.
  const live = isLive(m);
  const stale = isStaleLive(m);

  const [homeMatches, awayMatches, standings, anyLineups] = await Promise.all([
    repo.getTeamMatches(home.id),
    repo.getTeamMatches(away.id),
    repo.getStandings(competition.id).catch(() => null),
    // Not "this match has none yet" but "there are none here at all", which is
    // a different sentence and the true one while the second source is away.
    lineups ? Promise.resolve(true) : repo.holdsLineups(),
  ]);
  // Everything a match page can say without a provider's match detail. The
  // fixture is left out of its own build-up: a result cannot be part of the
  // form a club took into it.
  const context = buildMatchContext({
    homeId: home.id,
    awayId: away.id,
    homeMatches,
    awayMatches,
    rows: standings?.rows ?? [],
    excludeMatchId: m.id,
  });
  // What is riding on it, for a match still to be played. The table is
  // recomputed with each of the three results, which is free because the table
  // is computed from matches in the first place.
  const seasonTeams = m.status === "finished" ? [] : await repo.listTeams(competition.id);
  const why =
    seasonTeams.length > 0 && standings
      ? whyItMatters({
          stakes: stakes(
            view,
            (await repo.getCompetitionMatches(competition.id)).map((v) => v.match),
            seasonTeams.map((team) => team.id),
          ),
          home: context.home,
          away: context.away,
          h2h: context.h2h,
          places: standings.rows.length,
        })
      : [];

  const goals = events.filter(
    (e) => e.type === "goal" || e.type === "penalty" || e.type === "own_goal",
  );

  const status = live
    ? m.phase === "HT"
      ? t("ht")
      : m.minute == null
        ? t("liveWord")
        : livePhaseLabel(m.phase, m.minute)
    : m.status === "finished"
      ? t("fullTime")
      : stale
        ? t("noUpdate")
        : m.status === "postponed"
          ? t("postponed")
          : m.status === "cancelled"
            ? t("cancelled")
            : t("kickoff");

  return (
    <div className="space-y-8">
      <AutoRefresh enabled={live} seconds={20} />
      <nav className="text-sm text-muted" aria-label="Breadcrumb">
        <Link href={`/leagues/${competition.slug}`} className="hover:text-ink">
          {competitionName(competition, locale)}
        </Link>
        <span className="mx-2 text-faint">/</span>
        {competition.kind === "cup" && (
          <>
            <StageLabel stage={m.stage} /> ·{" "}
          </>
        )}
        {t("matchday", { n: m.round })}
      </nav>

      <section className="card px-4 py-6 sm:px-8">
        {/* The scoreboard below is a picture of the match: three columns, no
            sentence anywhere in it. This is the same thing in words, for a
            screen reader and for a search engine, which otherwise met the
            most-linked page on the site with no heading at all. */}
        <h1 className="sr-only">
          {m.score
            ? t("headingScore", {
                home: teamName(home, locale),
                away: teamName(away, locale),
                home_goals: m.score.home,
                away_goals: m.score.away,
                competition: competitionName(competition, locale),
              })
            : t("headingFixture", {
                home: teamName(home, locale),
                away: teamName(away, locale),
                competition: competitionName(competition, locale),
              })}
        </h1>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <TeamHeader team={home} align="end" locale={locale} />
          <div className="flex flex-col items-center gap-1">
            {m.score ? (
              <div className="text-4xl font-semibold tracking-tight sm:text-5xl">
                <Score home={m.score.home} away={m.score.away} className="[&>span]:mx-2" />
              </div>
            ) : (
              <div className="text-3xl font-semibold tracking-tight">
                <LocalTime iso={m.kickoff} />
              </div>
            )}
            <div
              className={`flex items-center gap-1.5 text-sm ${live ? "font-medium text-live" : "text-muted"}`}
            >
              {live && <span className="live-dot" />}
              {status}
            </div>
            {m.disputed && (
              <p className="mt-1 max-w-xs text-balance text-center text-xs text-review">
                {t("disputed")}
              </p>
            )}
            {m.halfTimeScore && m.status !== "scheduled" && (
              <div className="text-xs text-faint">
                {t("ht")}{" "}
                <Score
                  home={m.halfTimeScore.home}
                  away={m.halfTimeScore.away}
                  className="[&>span]:mx-0.5"
                />
              </div>
            )}
          </div>
          <TeamHeader team={away} align="start" locale={locale} />
        </div>
        {goals.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-6 border-t border-line pt-4 text-xs text-muted">
            <ul className="space-y-0.5 text-end">
              {goals
                .filter((g) => g.teamId === home.id)
                .map((g) => (
                  <li key={g.id}>
                    {players[g.playerId ?? ""]?.name ?? "—"}{" "}
                    <span className="tnum text-faint">{`${g.minute}${g.addedTime ? `+${g.addedTime}` : ""}'`}</span>
                    {g.type === "penalty"
                      ? ` ${t("pen")}`
                      : g.type === "own_goal"
                        ? ` ${t("og")}`
                        : ""}
                  </li>
                ))}
            </ul>
            <ul className="space-y-0.5">
              {goals
                .filter((g) => g.teamId === away.id)
                .map((g) => (
                  <li key={g.id}>
                    <span className="tnum text-faint">{`${g.minute}${g.addedTime ? `+${g.addedTime}` : ""}'`}</span>{" "}
                    {players[g.playerId ?? ""]?.name ?? "—"}
                    {g.type === "penalty"
                      ? ` ${t("pen")}`
                      : g.type === "own_goal"
                        ? ` ${t("og")}`
                        : ""}
                  </li>
                ))}
            </ul>
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-1 border-t border-line pt-4 text-xs text-muted">
          <span>
            <LocalTime iso={m.kickoff} withDate />
          </span>
          {m.venue && <span>{m.venue}</span>}
          {m.attendance && (
            <span className="tnum">
              {t("attendance", { n: m.attendance.toLocaleString("en-GB") })}
            </span>
          )}
          {m.referee && <span>{t("referee", { name: m.referee })}</span>}
        </div>
      </section>

      {why.length > 0 && (
        <WhyItMatters
          why={why}
          home={teamShortName(home, locale)}
          away={teamShortName(away, locale)}
        />
      )}

      <Section title={t("buildUp")}>
        <MatchBuildUp context={context} home={home} away={away} locale={locale} />
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title={t("lineups")}>
          {lineups ? (
            <LineupPitch
              home={lineups.home}
              away={lineups.away}
              homeTeam={home}
              awayTeam={away}
              players={players}
            />
          ) : (
            <Empty>
              {!anyLineups
                ? t("lineupsNoSource")
                : m.status === "scheduled"
                  ? t("lineupsLater")
                  : t("lineupsUnavailable")}
            </Empty>
          )}
        </Section>
        <div className="space-y-8">
          <Section title={t("timeline")}>
            {m.status === "scheduled" ? (
              <Empty>
                {t("kickoff")} · <LocalTime iso={m.kickoff} withDate />
              </Empty>
            ) : (
              <EventTimeline
                events={events}
                home={home}
                away={away}
                players={players}
                halfTime={m.halfTimeScore}
                fullTime={m.score}
                finished={m.status === "finished"}
                complete={m.timelineComplete}
              />
            )}
          </Section>
          <Section title={t("h2h")}>
            {context.h2h.recent.length ? (
              <div className="card divide-y divide-line overflow-hidden">
                {context.h2h.recent.map((v) => (
                  <MatchRow key={v.match.id} view={v} showRound />
                ))}
              </div>
            ) : (
              <Empty>{t("noH2h")}</Empty>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function TeamHeader({
  team,
  align,
  locale,
}: {
  team: Team;
  align: "start" | "end";
  locale: string;
}) {
  return (
    <Link
      href={`/teams/${team.slug}`}
      className={`flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-4 ${align === "end" ? "sm:flex-row-reverse sm:text-end" : "sm:text-start"}`}
    >
      <TeamCrest team={team} size={56} />
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold sm:text-xl">
          {teamName(team, locale)}
        </span>
        {team.city && <span className="hidden text-xs text-muted sm:block">{team.city}</span>}
      </span>
    </Link>
  );
}
