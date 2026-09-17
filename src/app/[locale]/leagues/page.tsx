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
  // Eleven competitions in one run is a list; a league and a European cup are
  // different things and a reader looking for one is not looking for the
  // other. The split is the competition's own `kind`, so nothing here decides
  // what anything is.
  const groups = [
    {
      key: "leagues",
      title: t("groupLeagues"),
      blocks: blocks.filter(({ c }) => c.kind === "league"),
    },
    { key: "cups", title: t("groupCups"), blocks: blocks.filter(({ c }) => c.kind === "cup") },
  ].filter((g) => g.blocks.length > 0);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{tm("leagues")}</h1>
        <p className="text-sm text-muted">{t("intro")}</p>
      </header>
      {groups.map(({ key, title, blocks }) => (
        <section key={key} className="space-y-4">
          {groups.length > 1 && (
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-faint">
              {title}
            </h2>
          )}
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
                  <span className="shrink-0 text-sm text-muted">{t("fullTable")}</span>
                </Link>
                {standings.rows.length > 0 ? (
                  <StandingsTable standings={standings} competition={c} teams={teams} compact />
                ) : (
                  <p className="card px-4 py-6 text-center text-sm text-muted">{t("noTableYet")}</p>
                )}
              </section>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
