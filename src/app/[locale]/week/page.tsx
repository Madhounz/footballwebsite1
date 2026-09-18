import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Section, Stat } from "@/components/Section";
import { WeekBars } from "@/components/WeekBars";
import { WeekSection } from "@/components/WeekSection";
import { getRepository, matchesOnDate } from "@/lib/data";
import { goalsPerMatch, weekReport } from "@/lib/data/week";
import { addDays, formatMediumDate } from "@/lib/dates";
import { viewerToday } from "@/lib/viewer";
import { pageMeta } from "@/lib/seo";

/**
 * The last seven days, across every competition at once.
 *
 * Seven day queries and a table for each competition that actually played —
 * no competition is read for a week it had no part in. Everything on the page
 * is arithmetic on a scoreline and a half-time score, which we hold for every
 * match, so unlike a highlights reel this is complete rather than a selection.
 */
const DAYS = 7;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "week" });
  return pageMeta({ locale, path: "/week", title: t("title"), description: t("lead") });
}

export default async function WeekPage() {
  const t = await getTranslations("week");
  const locale = await getLocale();
  const repo = await getRepository();
  const today = await viewerToday();
  const dates = Array.from({ length: DAYS }, (_, i) => addDays(today, -(DAYS - 1 - i)));
  const days = await Promise.all(
    dates.map(async (date) => ({ date, views: await matchesOnDate(date) })),
  );

  // Only the competitions that played this week need a table behind them.
  const ids = [...new Set(days.flatMap((d) => d.views.map((v) => v.competition.id)))];
  const places = new Map(
    await Promise.all(
      ids.map(
        async (id) =>
          [id, new Map((await repo.getStandings(id)).rows.map((r) => [r.teamId, r.position]))] as [
            string,
            Map<string, number>,
          ],
      ),
    ),
  );
  const report = weekReport(days, places);
  const perMatch = goalsPerMatch(report);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted">
          {t("range", {
            from: formatMediumDate(report.from, locale),
            to: formatMediumDate(report.to, locale),
          })}
        </p>
        <p className="max-w-2xl pt-1 text-sm text-muted">{t("lead")}</p>
      </header>

      {report.played === 0 ? (
        <div className="card px-6 py-14 text-center text-sm text-muted">{t("quiet")}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t("matches")} value={report.played} />
            <Stat
              label={t("goals")}
              value={report.goals}
              hint={t("perMatch", { n: perMatch ?? 0 })}
            />
            <Stat
              label={t("results")}
              value={`${report.homeWins}·${report.draws}·${report.awayWins}`}
              hint={t("resultsHint")}
            />
            <Stat
              label={t("cleanSheets")}
              value={report.cleanSheets}
              hint={t("goalless", { n: report.goalless })}
            />
          </div>

          <Section title={t("byDay")}>
            <WeekBars days={report.byDay} today={today} />
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title={t("comebacks")}>
              <WeekSection kind="comebacks" picks={report.comebacks} empty={t("noComebacks")} />
            </Section>
            <Section title={t("upsets")}>
              <WeekSection kind="upsets" picks={report.upsets} empty={t("noUpsets")} />
            </Section>
            <Section title={t("thrillers")}>
              <WeekSection kind="thrillers" picks={report.thrillers} empty={t("noThrillers")} />
            </Section>
            <Section title={t("thrashings")}>
              <WeekSection kind="thrashings" picks={report.thrashings} empty={t("noThrashings")} />
            </Section>
          </div>

          <p className="text-xs text-faint">{t("note")}</p>
        </>
      )}
    </div>
  );
}
