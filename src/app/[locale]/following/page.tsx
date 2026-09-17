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

export default async function FollowingPage() {
  const t = await getTranslations("follow");
  const locale = await getLocale();
  const repo = await getRepository();
  const [teams, competitions] = await Promise.all([repo.listTeams(), repo.listCompetitions()]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted">{t("lead")}</p>
      </header>
      <MyClubs
        names={Object.fromEntries(teams.map((team) => [team.id, teamShortName(team, locale)]))}
        competitions={Object.fromEntries(
          competitions.map((c) => [c.id, competitionName(c, locale)]),
        )}
      />
    </div>
  );
}
