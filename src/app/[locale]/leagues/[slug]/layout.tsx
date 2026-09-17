import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Tabs } from "@/components/Tabs";
import { getRepository } from "@/lib/data";
import { pageMeta } from "@/lib/seo";
import { competitionName, countryName } from "@/lib/i18n/names";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const repo = await getRepository();
  const c = await repo.getCompetitionBySlug(slug);
  if (!c) return {};
  const t = await getTranslations({ locale, namespace: "league" });
  return pageMeta({
    locale,
    path: `/leagues/${c.slug}`,
    title: `${competitionName(c, locale)} ${c.season}`,
    description: t("metaDescription", { league: competitionName(c, locale), season: c.season }),
  });
}

export default async function LeagueLayout({
  params,
  children,
}: {
  params: Params;
  children: React.ReactNode;
}) {
  const t = await getTranslations("league");
  const tm = await getTranslations("match");
  const locale = await getLocale();
  const repo = await getRepository();
  const { slug } = await params;
  const c = await repo.getCompetitionBySlug(slug);
  if (!c) notFound();
  const base = `/leagues/${c.slug}`;
  // `getLiveMatches` is already bounded by kick-off, so a stale record cannot
  // put a pulsing badge on a competition that finished playing hours ago.
  const live = (await repo.getLiveMatches()).filter((v) => v.competition.id === c.id).length;
  // Past winners are curated by hand, so a competition can be fully covered
  // and still have none. A tab that only ever says "nothing here" is worse
  // than no tab.
  const hasHistory = Boolean(await repo.getHonours(c.id));
  const name = competitionName(c, locale);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-faint">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: c.color }}
              aria-hidden="true"
            />
            {countryName(c.countryCode, locale, c.country)} ·{" "}
            {c.kind === "cup"
              ? t("uefa")
              : (c.tier ?? 1) > 1
                ? t("tier", { n: c.tier ?? 1 })
                : t("topFlight")}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{name}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          {live > 0 && (
            <span className="flex items-center gap-1.5 font-medium text-live">
              <span className="live-dot" /> {tm("live", { count: live })}
            </span>
          )}
          <span>{t("season", { season: c.season })}</span>
        </div>
      </header>
      <Tabs
        ariaLabel={t("sections", { name })}
        tabs={[
          { href: base, label: t("tabTable"), exact: true },
          { href: `${base}/fixtures`, label: t("tabFixtures") },
          { href: `${base}/results`, label: t("tabResults") },
          { href: `${base}/race`, label: t("tabRace") },
          { href: `${base}/run-in`, label: t("tabRunIn") },
          { href: `${base}/halves`, label: t("tabHalves") },
          { href: `${base}/stats`, label: t("tabScorers") },
          ...(hasHistory ? [{ href: `${base}/history`, label: t("tabHistory") }] : []),
        ]}
      />
      {children}
    </div>
  );
}
