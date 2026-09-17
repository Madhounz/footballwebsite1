import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { RaceChart, RaceKey } from "@/components/RaceChart";
import { Empty, Section } from "@/components/Section";
import { TeamCrest } from "@/components/TeamCrest";
import { getRepository } from "@/lib/data";
import { movers, race, type Mover } from "@/lib/data/race";
import { teamShortName } from "@/lib/i18n/names";
import type { Team } from "@/lib/types";

/** How far back "climbing" and "falling" look. Five rounds is about a month. */
const WINDOW = 5;

export default async function RacePage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getTranslations("league");
  const repo = await getRepository();
  const c = await repo.getCompetitionBySlug((await params).slug);
  if (!c) notFound();
  const [teamList, views] = await Promise.all([
    repo.listTeams(c.id),
    repo.getCompetitionMatches(c.id),
  ]);
  const teams = new Map(teamList.map((team) => [team.id, team]));
  const drawn = race(
    c.id,
    c.season,
    teamList.map((team) => team.id),
    views.map((v) => v.match),
  );
  // One round is a chart with nothing to show but a single column of dots.
  if (drawn.rounds.length < 2) return <Empty>{t("raceTooEarly")}</Empty>;
  const moved = movers(drawn, WINDOW);

  return (
    <div className="space-y-8">
      <Section title={t("raceTitle")}>
        <p className="max-w-2xl text-sm text-muted">{t("raceLead")}</p>
        <RaceChart race={drawn} teams={teams} competition={c} />
        <RaceKey race={drawn} teams={teams} competition={c} />
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t("raceClimbing")} action={<span>{t("raceWindow", { n: WINDOW })}</span>}>
          <MoverList movers={moved.up} teams={teams} empty={t("raceNone")} />
        </Section>
        <Section title={t("raceFalling")} action={<span>{t("raceWindow", { n: WINDOW })}</span>}>
          <MoverList movers={moved.down} teams={teams} empty={t("raceNone")} />
        </Section>
      </div>
    </div>
  );
}

async function MoverList({
  movers,
  teams,
  empty,
}: {
  movers: Mover[];
  teams: Map<string, Team>;
  empty: string;
}) {
  const t = await getTranslations("league");
  const locale = await getLocale();
  if (movers.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="card divide-y divide-line overflow-hidden">
      {movers.map((m, i) => {
        const team = teams.get(m.teamId);
        if (!team) return null;
        const up = m.change > 0;
        return (
          <li key={m.teamId}>
            <Link
              href={`/teams/${team.slug}`}
              className="rise row-hover flex items-center gap-3 px-4 py-2.5"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <TeamCrest team={team} size={24} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {teamShortName(team, locale)}
              </span>
              <span className="tnum text-xs text-muted" dir="ltr">
                {t("raceMove", { from: m.from, to: m.to })}
              </span>
              <span
                className={`tnum flex items-center gap-1 text-sm font-semibold ${up ? "text-win" : "text-loss"}`}
              >
                <span aria-hidden="true">{up ? "▲" : "▼"}</span>
                {Math.abs(m.change)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
