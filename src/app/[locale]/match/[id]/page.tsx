import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { EventTimeline } from "@/components/EventTimeline";
import { LineupPitch } from "@/components/LineupPitch";
import { LocalTime } from "@/components/LocalTime";
import { MatchRow } from "@/components/MatchRow";
import { Empty, Section } from "@/components/Section";
import { Score } from "@/components/Score";
import { StageLabel } from "@/components/StageLabel";
import { TeamCrest } from "@/components/TeamCrest";
import { getRepository } from "@/lib/data";
import { livePhaseLabel } from "@/lib/format";
import { competitionName, teamName, teamShortName } from "@/lib/i18n/names";
import type { MatchView, Team } from "@/lib/types";

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, id } = await params;
  const repo = await getRepository();
  const d = await repo.getMatch(id);
  if (!d) return {};
  const { match: m, home, away } = d.view;
  const score = m.score ? `${m.score.home}–${m.score.away}` : "v";
  return { title: `${teamShortName(home, locale)} ${score} ${teamShortName(away, locale)}` };
}

export default async function MatchPage({ params }: { params: Params }) {
  const t = await getTranslations("match");
  const locale = await getLocale();
  const repo = await getRepository();
  const detail = await repo.getMatch((await params).id);
  if (!detail) notFound();
  const { view, events, lineups, players } = detail;
  const { match: m, home, away, competition } = view;
  const live = m.status === "live";

  const [homeMatches, awayMatches] = await Promise.all([
    repo.getTeamMatches(home.id),
    repo.getTeamMatches(away.id),
  ]);
  const h2h = homeMatches
    .filter(
      (v) =>
        v.match.status === "finished" &&
        (v.home.id === away.id || v.away.id === away.id) &&
        v.match.id !== m.id,
    )
    .slice(-5)
    .reverse();
  const homeForm = homeMatches
    .filter((v) => v.match.status === "finished" && v.match.id !== m.id)
    .slice(-5)
    .reverse();
  const awayForm = awayMatches
    .filter((v) => v.match.status === "finished" && v.match.id !== m.id)
    .slice(-5)
    .reverse();
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
            <Empty>{m.status === "scheduled" ? t("lineupsLater") : t("lineupsUnavailable")}</Empty>
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
                finished={m.status === "finished"}
              />
            )}
          </Section>
          <Section title={t("form")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormList
                title={teamShortName(home, locale)}
                views={homeForm}
                teamId={home.id}
                locale={locale}
                empty={t("noResults")}
                vs={t("vs")}
                at={t("at")}
              />
              <FormList
                title={teamShortName(away, locale)}
                views={awayForm}
                teamId={away.id}
                locale={locale}
                empty={t("noResults")}
                vs={t("vs")}
                at={t("at")}
              />
            </div>
          </Section>
          <Section title={t("h2h")}>
            {h2h.length ? (
              <div className="card divide-y divide-line overflow-hidden">
                {h2h.map((v) => (
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
        <span className="hidden text-xs text-muted sm:block">{team.city}</span>
      </span>
    </Link>
  );
}

function FormList({
  title,
  views,
  teamId,
  locale,
  empty,
  vs,
  at,
}: {
  title: string;
  views: MatchView[];
  teamId: string;
  locale: string;
  empty: string;
  vs: string;
  at: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line px-3 py-2 text-xs font-semibold">{title}</div>
      <ul className="divide-y divide-line text-xs">
        {views.length === 0 && <li className="px-3 py-3 text-muted">{empty}</li>}
        {views.map((v) => {
          const isHome = v.home.id === teamId;
          const opp = isHome ? v.away : v.home;
          const gf = isHome ? v.match.score!.home : v.match.score!.away;
          const ga = isHome ? v.match.score!.away : v.match.score!.home;
          const r = gf > ga ? "W" : gf === ga ? "D" : "L";
          return (
            <li key={v.match.id}>
              <Link
                href={`/match/${v.match.id}`}
                className="row-hover tnum flex items-center gap-2 px-3 py-1.5"
              >
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded-[4px] text-[9px] font-semibold text-white ${r === "W" ? "bg-win" : r === "D" ? "bg-draw" : "bg-loss"}`}
                >
                  {r}
                </span>
                <span className="flex-1 truncate">
                  {isHome ? vs : at} {teamShortName(opp, locale)}
                </span>
                <span className="font-medium" dir="ltr">
                  {gf}–{ga}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
