import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Tabs } from "@/components/Tabs";
import { getRepository } from "@/lib/data";
import { competitionName, countryName } from "@/lib/i18n/names";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const repo = await getRepository();
  const c = await repo.getCompetitionBySlug(slug);
  if (!c) return {};
  return { title: `${competitionName(c, locale)} ${c.season}` };
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
  const live = (await repo.getLiveMatches()).filter((v) => v.competition.id === c.id).length;
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
            {c.kind === "cup" ? t("uefa") : t("topFlight")}
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
          { href: `${base}/stats`, label: t("tabScorers") },
          { href: `${base}/history`, label: t("tabHistory") },
        ]}
      />
      {children}
    </div>
  );
}
