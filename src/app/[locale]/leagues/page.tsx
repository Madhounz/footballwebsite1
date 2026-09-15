import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { StandingsTable } from "@/components/StandingsTable";
import { getRepository } from "@/lib/data";
import { competitionName, countryName } from "@/lib/i18n/names";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("leagues") };
}

export default async function LeaguesPage() {
  const t = await getTranslations("league");
  const tm = await getTranslations("meta");
  const locale = await getLocale();
  const repo = await getRepository();
  const competitions = await repo.listCompetitions();
  const blocks = await Promise.all(
    competitions.map(async (c) => {
      const [standings, teams] = await Promise.all([repo.getStandings(c.id), repo.listTeams(c.id)]);
      return {
        c,
        standings: { ...standings, rows: standings.rows.slice(0, 6) },
        teams: new Map(teams.map((team) => [team.id, team])),
      };
    }),
  );
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{tm("leagues")}</h1>
        <p className="text-sm text-muted">{t("intro")}</p>
      </header>
      <div className="grid gap-5 md:grid-cols-2">
        {blocks.map(({ c, standings, teams }) => (
          <section key={c.id} className="space-y-2">
            <Link href={`/leagues/${c.slug}`} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-base font-semibold hover:underline">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: c.color }}
                  aria-hidden="true"
                />
                {competitionName(c, locale)}
                <span className="text-sm font-normal text-faint">
                  {countryName(c.countryCode, locale, c.country)} · {c.season}
                </span>
              </span>
              <span className="text-sm text-muted">{t("fullTable")}</span>
            </Link>
            <StandingsTable standings={standings} competition={c} teams={teams} compact />
          </section>
        ))}
      </div>
    </div>
  );
}
