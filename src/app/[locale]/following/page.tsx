import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { MyClubs } from "@/components/MyClubs";
import { getRepository } from "@/lib/data";
import { competitionName, teamShortName } from "@/lib/i18n/names";

/**
 * The one page on the site the server cannot render.
 *
 * Followed clubs live on the device and never reach us, so all this can do is
 * hand the browser the two things it cannot work out for itself — how to say
 * every club and competition name in the reader's language — and let the page
 * assemble itself. Not indexed, because there is nothing here to index: what
 * a crawler would see is what somebody who follows nobody sees.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("following"), robots: { index: false, follow: true } };
}

/** How many clubs the empty page offers, one per competition. */
const SUGGESTED = 6;

export default async function FollowingPage() {
  const t = await getTranslations("follow");
  const locale = await getLocale();
  const repo = await getRepository();
  const [teams, competitions] = await Promise.all([repo.listTeams(), repo.listCompetitions()]);
  const byId = new Map(teams.map((team) => [team.id, team]));
  // Somewhere to start, chosen by the table rather than by us: whoever is top
  // of each competition today. It needs no taste to defend and it changes on
  // its own, which is the only kind of recommendation this site should make.
  const leaders = (
    await Promise.all(
      competitions.slice(0, SUGGESTED).map(async (c) => {
        const top = (await repo.getStandings(c.id)).rows[0];
        const team = top ? byId.get(top.teamId) : undefined;
        return team
          ? {
              id: team.id,
              name: teamShortName(team, locale),
              code: team.code,
              colors: team.colors,
              crestUrl: team.crestUrl ?? null,
              competition: competitionName(c, locale),
              color: c.color,
            }
          : null;
      }),
    )
  ).filter((x) => x !== null);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted">{t("lead")}</p>
      </header>
      <MyClubs
        suggestions={leaders}
        names={Object.fromEntries(teams.map((team) => [team.id, teamShortName(team, locale)]))}
        competitions={Object.fromEntries(
          competitions.map((c) => [c.id, competitionName(c, locale)]),
        )}
      />
    </div>
  );
}
