import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { HalfSlope } from "@/components/HalfSlope";
import { HalfSwitch } from "@/components/HalfSwitch";
import { Empty, Section } from "@/components/Section";
import { StandingsTable } from "@/components/StandingsTable";
import { TeamCrest } from "@/components/TeamCrest";
import { getRepository } from "@/lib/data";
import { halfTable, turnarounds, type Half, type Turnaround } from "@/lib/data/halves";
import { teamShortName } from "@/lib/i18n/names";
import type { Team } from "@/lib/types";

export default async function HalvesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ half?: string }>;
}) {
  const t = await getTranslations("league");
  const repo = await getRepository();
  const c = await repo.getCompetitionBySlug((await params).slug);
  if (!c) notFound();
  const half: Half = (await searchParams).half === "first" ? "first" : "second";
  const [teamList, views, table] = await Promise.all([
    repo.listTeams(c.id),
    repo.getCompetitionMatches(c.id),
    repo.getStandings(c.id),
  ]);
  const teams = new Map(teamList.map((team) => [team.id, team]));
  const matches = views.map((v) => v.match);
  const ids = teamList.map((team) => team.id);
  const second = halfTable(c.id, c.season, ids, matches, "second");
  const shown = half === "second" ? second : halfTable(c.id, c.season, ids, matches, "first");
  // Without half-time scores there is no second season to show, and saying so
  // beats a table of twenty clubs on no points each.
  if (second.rows.every((r) => r.played === 0)) return <Empty>{t("halvesTooEarly")}</Empty>;

  const moved = turnarounds(matches, ids);
  const won = moved
    .filter((m) => m.gained > 0)
    .sort((a, b) => b.gained - a.gained || b.comebacks.length - a.comebacks.length)
    .slice(0, 5);
  const lost = moved
    .filter((m) => m.dropped > 0)
    .sort((a, b) => b.dropped - a.dropped || b.collapses.length - a.collapses.length)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <Section title={t("halvesTitle")}>
        <p className="max-w-2xl text-sm text-muted">{t("halvesLead")}</p>
        <HalfSlope table={table.rows} half={second.rows} teams={teams} />
      </Section>

      <Section title={t("halfTable")} action={<HalfSwitch slug={c.slug} half={half} />}>
        {/* No zones: the places that qualify are places in a season, not in a
            half of one — the same reason the home and away tables drop them. */}
        <StandingsTable standings={shown} competition={c} teams={teams} zones={false} />
        <p className="mt-2 text-xs text-faint">{t("halfNote")}</p>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t("halfWon")}>
          <SwingList rows={won} teams={teams} kind="won" empty={t("halfNobody")} />
        </Section>
        <Section title={t("halfLost")}>
          <SwingList rows={lost} teams={teams} kind="lost" empty={t("halfNobody")} />
        </Section>
      </div>
    </div>
  );
}

async function SwingList({
  rows,
  teams,
  kind,
  empty,
}: {
  rows: Turnaround[];
  teams: Map<string, Team>;
  kind: "won" | "lost";
  empty: string;
}) {
  const t = await getTranslations("league");
  const locale = await getLocale();
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="card divide-y divide-line overflow-hidden">
      {rows.map((row, i) => {
        const team = teams.get(row.teamId);
        if (!team) return null;
        const points = kind === "won" ? row.gained : row.dropped;
        const n = kind === "won" ? row.comebacks.length : row.collapses.length;
        return (
          <li key={row.teamId}>
            <Link
              href={`/teams/${team.slug}`}
              className="rise row-hover flex items-center gap-3 px-4 py-2.5"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <TeamCrest team={team} size={24} />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-sm font-medium">{teamShortName(team, locale)}</span>
                <span className="truncate text-[11px] text-muted">
                  {t(kind === "won" ? "halfWonHint" : "halfLostHint", { n })}
                </span>
              </span>
              <span
                className={`tnum text-sm font-semibold ${kind === "won" ? "text-win" : "text-loss"}`}
                dir="ltr"
              >
                {kind === "won" ? "+" : "−"}
                {points}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
