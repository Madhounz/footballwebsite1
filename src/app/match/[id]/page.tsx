import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { EventTimeline } from "@/components/EventTimeline";
import { LineupPitch } from "@/components/LineupPitch";
import { LocalTime } from "@/components/LocalTime";
import { MatchRow } from "@/components/MatchRow";
import { Empty, Section } from "@/components/Section";
import { TeamCrest } from "@/components/TeamCrest";
import { getRepository } from "@/lib/data";
import { livePhaseLabel } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const repo = await getRepository();
  const d = await repo.getMatch((await params).id);
  if (!d) return {};
  const { match: m, home, away } = d.view;
  const score = m.score ? `${m.score.home}–${m.score.away}` : "v";
  return { title: `${home.shortName} ${score} ${away.shortName}` };
}

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
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

  return (
    <div className="space-y-8">
      <AutoRefresh enabled={live} seconds={20} />
      <nav className="text-sm text-muted" aria-label="Breadcrumb">
        <Link href={`/leagues/${competition.slug}`} className="hover:text-ink">
          {competition.name}
        </Link>
        <span className="mx-2 text-faint">/</span>
        {competition.kind === "cup" ? `${m.stage} · ` : ""}Matchday {m.round}
      </nav>

      <section className="card px-4 py-6 sm:px-8">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <TeamHeader team={home} align="end" />
          <div className="flex flex-col items-center gap-1">
            {m.score ? (
              <div className="tnum text-4xl font-semibold tracking-tight sm:text-5xl">
                {m.score.home}
                <span className="mx-2 text-faint">–</span>
                {m.score.away}
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
              {live
                ? livePhaseLabel(m.phase, m.minute)
                : m.status === "finished"
                  ? "Full time"
                  : m.status === "postponed"
                    ? "Postponed"
                    : m.status === "cancelled"
                      ? "Cancelled"
                      : "Kick-off"}
            </div>
            {m.halfTimeScore && m.status !== "scheduled" && (
              <div className="tnum text-xs text-faint">
                HT {m.halfTimeScore.home}–{m.halfTimeScore.away}
              </div>
            )}
          </div>
          <TeamHeader team={away} align="start" />
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
                    {g.type === "penalty" ? " (pen)" : g.type === "own_goal" ? " (og)" : ""}
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
                    {g.type === "penalty" ? " (pen)" : g.type === "own_goal" ? " (og)" : ""}
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
            <span className="tnum">Att. {m.attendance.toLocaleString("en-GB")}</span>
          )}
          {m.referee && <span>Referee: {m.referee}</span>}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Line-ups">
          {lineups ? (
            <LineupPitch
              home={lineups.home}
              away={lineups.away}
              homeTeam={home}
              awayTeam={away}
              players={players}
            />
          ) : (
            <Empty>Line-ups are published about an hour before kick-off.</Empty>
          )}
        </Section>
        <div className="space-y-8">
          <Section title="Timeline">
            {m.status === "scheduled" ? (
              <Empty>
                Kick-off <LocalTime iso={m.kickoff} withDate />.
              </Empty>
            ) : (
              <EventTimeline
                events={events}
                home={home}
                away={away}
                players={players}
                halfTime={m.halfTimeScore}
              />
            )}
          </Section>
          <Section title="Form">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormList title={home.shortName} views={homeForm} teamId={home.id} />
              <FormList title={away.shortName} views={awayForm} teamId={away.id} />
            </div>
          </Section>
          <Section title="Head to head">
            {h2h.length ? (
              <div className="card divide-y divide-line overflow-hidden">
                {h2h.map((v) => (
                  <MatchRow key={v.match.id} view={v} showRound />
                ))}
              </div>
            ) : (
              <Empty>No previous meetings this season.</Empty>
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
}: {
  team: Awaited<ReturnType<Awaited<ReturnType<typeof getRepository>>["getTeamById"]>> & object;
  align: "start" | "end";
}) {
  return (
    <Link
      href={`/teams/${team.slug}`}
      className={`flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-4 ${align === "end" ? "sm:flex-row-reverse sm:text-end" : "sm:text-start"}`}
    >
      <TeamCrest team={team} size={56} />
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold sm:text-xl">{team.name}</span>
        <span className="hidden text-xs text-muted sm:block">{team.city}</span>
      </span>
    </Link>
  );
}

function FormList({
  title,
  views,
  teamId,
}: {
  title: string;
  views: import("@/lib/types").MatchView[];
  teamId: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line px-3 py-2 text-xs font-semibold">{title}</div>
      <ul className="divide-y divide-line text-xs">
        {views.length === 0 && <li className="px-3 py-3 text-muted">No results yet.</li>}
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
                  {isHome ? "vs" : "at"} {opp.shortName}
                </span>
                <span className="font-medium">
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
