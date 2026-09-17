import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TeamCrest } from "@/components/TeamCrest";
import { getRepository } from "@/lib/data";
import { competitionName, teamName, teamShortName } from "@/lib/i18n/names";
import type { Team } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("teams") };
}

export default async function TeamsPage() {
  const t = await getTranslations("team");
  const tm = await getTranslations("meta");
  const locale = await getLocale();
  const repo = await getRepository();
  const [competitions, teams] = await Promise.all([repo.listCompetitions(), repo.listTeams()]);
  const leagues = competitions.filter((c) => c.kind === "league");
  const others = teams.filter((team) => !team.leagueId);
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{tm("teams")}</h1>
        <p className="text-sm text-muted">{t("intro")}</p>
      </header>
      {leagues.map((c) => (
        <section key={c.id} className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: c.color }}
              aria-hidden="true"
            />
            {competitionName(c, locale)}
          </h2>
          <Grid teams={teams.filter((team) => team.leagueId === c.id)} locale={locale} />
        </section>
      ))}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("others")}</h2>
        <Grid teams={others} locale={locale} />
      </section>
    </div>
  );
}

function Grid({ teams, locale }: { teams: Team[]; locale: string }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {teams.map((team) => (
        <li key={team.id}>
          <Link
            href={`/teams/${team.slug}`}
            className="card row-hover @container flex items-center gap-3 px-3 py-2.5"
          >
            <TeamCrest team={team} size={30} />
            <span className="min-w-0">
              {/* Two cards across a phone leave about 110px for a name, and
                  "Brighton & Hove Albion" is not 110px. Below the width where
                  the full name fits, the card carries the name everyone says
                  out loud instead of the first half of the formal one. */}
              <span className="block truncate text-sm font-medium">
                <span className="hidden @[240px]:inline">{teamName(team, locale)}</span>
                <span className="@[240px]:hidden">{teamShortName(team, locale)}</span>
              </span>
              <span className="block truncate text-xs text-muted">{team.city}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
