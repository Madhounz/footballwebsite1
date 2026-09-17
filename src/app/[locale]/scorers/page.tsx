import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { AcrossKey, AcrossTable } from "@/components/AcrossTable";
import { Section } from "@/components/Section";
import { TeamCrest } from "@/components/TeamCrest";
import { Link } from "@/i18n/navigation";
import { getRepository } from "@/lib/data";
import { goalsAcross } from "@/lib/data/across";
import { competitionName } from "@/lib/i18n/names";
import { pageMeta } from "@/lib/seo";

/**
 * Who has scored the most this season, across everything we cover.
 *
 * Every competition already stores its own chart; nobody had ever added them
 * up. The page gets better the more competitions the site follows, which is
 * the right way round for a feature to scale.
 */
const DEPTH = 100;
const SHOWN = 40;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "scorers" });
  return pageMeta({ locale, path: "/scorers", title: t("title"), description: t("lead") });
}

export default async function ScorersPage() {
  const t = await getTranslations("scorers");
  const locale = await getLocale();
  const repo = await getRepository();
  const competitions = await repo.listCompetitions();
  const [charts, teamList, playerList] = await Promise.all([
    Promise.all(
      competitions.map(async (c) => ({
        competition: c,
        chart: await repo.getTopScorers(c.id, DEPTH),
      })),
    ),
    repo.listTeams(),
    repo.listPlayers(),
  ]);
  const teams = new Map(teamList.map((team) => [team.id, team]));
  const players = new Map(playerList.map((p) => [p.id, p]));
  const byId = new Map(competitions.map((c) => [c.id, c]));
  const rows = goalsAcross(
    charts.map(({ competition, chart }) => ({ competitionId: competition.id, rows: chart.rows })),
    SHOWN,
  );
  // Only the competitions that actually contributed a goal get a colour in the
  // key; a competition whose season has not started yet would otherwise be a
  // swatch matching nothing on the page.
  const scoring = competitions.filter((c) =>
    rows.some((r) => r.parts.some((p) => p.competitionId === c.id && p.goals > 0)),
  );
  const leaders = charts
    .map(({ competition, chart }) => ({ competition, row: chart.rows[0] }))
    .filter((l) => l.row && l.row.goals > 0);
  // Where the numbers came from. The provider's chart for a live deployment,
  // our own count for the demo — and the page says which rather than letting
  // a total imply an authority it does not have.
  const counted = charts.some(({ chart }) => chart.rows.length > 0 && chart.source === "matches");

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-sm text-muted">{t("lead")}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-3">
          <AcrossTable rows={rows} players={players} teams={teams} competitions={byId} />
          <p className="text-xs text-faint">{counted ? t("noteCounted") : t("note")}</p>
        </div>

        <aside className="min-w-0 space-y-5">
          <div className="space-y-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-faint">
              {t("key")}
            </h2>
            <AcrossKey competitions={scoring} />
          </div>

          <Section title={t("leading")}>
            <ul className="card divide-y divide-line overflow-hidden">
              {leaders.map(({ competition, row }) => {
                const player = players.get(row.playerId);
                const team = teams.get(row.teamId);
                if (!player || !team) return null;
                return (
                  <li key={competition.id}>
                    <Link
                      href={`/leagues/${competition.slug}/stats`}
                      className="row-hover flex items-center gap-2.5 px-3 py-2"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: competition.color }}
                        aria-hidden="true"
                      />
                      <span className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate text-[11px] text-faint">
                          {competitionName(competition, locale)}
                        </span>
                        <span className="truncate text-sm">{player.name}</span>
                      </span>
                      <TeamCrest team={team} size={18} />
                      <span className="tnum text-sm font-semibold">{row.goals}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Section>
        </aside>
      </div>
    </div>
  );
}
