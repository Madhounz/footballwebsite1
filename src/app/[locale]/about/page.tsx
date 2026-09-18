import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Mark } from "@/components/Logo";
import { getRepository } from "@/lib/data";
import { siteCoverage } from "@/lib/data/coverage";
import { competitionName } from "@/lib/i18n/names";
import { SITE } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("about"), description: t("aboutDescription") };
}

/**
 * The page that describes the product.
 *
 * Nothing factual on it is typed out. What is covered, what is live, what is
 * missing and how often it refreshes all come from `siteCoverage()`, which
 * counts rows. A page of claims maintained by hand is a page that is wrong a
 * month later, and this one had got there: six competitions when there were
 * eleven, the Europa League promised as future while it sat in the navigation.
 */
export default async function AboutPage() {
  const t = await getTranslations("about");
  const locale = await getLocale();
  const repo = await getRepository();
  const coverage = await siteCoverage();
  const list = new Intl.ListFormat(locale, { style: "long", type: "conjunction" });
  const covered = list.format(coverage.competitions.map((c) => competitionName(c, locale)));

  // Said only where it is true, and said the same way whether it is good news
  // or bad: the timeline inside a match either exists or it does not.
  const live = [
    t("liveTables", { count: coverage.competitions.length }),
    coverage.scorers !== "none" &&
      t(coverage.scorers === "provider" ? "liveScorersProvider" : "liveScorersCounted"),
    coverage.matchEvents && t("liveEvents"),
    coverage.lineups && t("liveLineups"),
    t("liveRefresh", { n: coverage.refreshMinutes }),
  ].filter((x): x is string => typeof x === "string");

  const missing = [
    !coverage.matchEvents && t("missingEvents"),
    !coverage.lineups && t("missingLineups"),
  ].filter((x): x is string => typeof x === "string");

  return (
    <article className="mx-auto max-w-2xl space-y-12">
      <header className="space-y-5">
        <Mark size={44} className="text-ink" />
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-lg leading-relaxed text-muted">{t("lead")}</p>
      </header>

      <Block title={t("hereTitle")}>
        <Points
          items={[
            t("here1", { count: coverage.competitions.length }),
            t("here2"),
            t("here3"),
            t("here4"),
          ]}
        />
      </Block>

      <Block title={t("nowTitle")}>
        <p className="leading-relaxed text-muted">{t("covering", { competitions: covered })}</p>
        <Points items={live} />
      </Block>

      {missing.length > 0 && (
        <Block title={t("missingTitle")}>
          <Points items={missing} muted />
          <p className="text-sm leading-relaxed text-faint">{t("missingWhy")}</p>
        </Block>
      )}

      <Block title={t("sourcesTitle")}>
        <p className="leading-relaxed text-muted">{t("sources")}</p>
        {/* Only where it is true. A production reader never meets this. */}
        {repo.info().kind === "demo" && <p className="text-sm text-faint">{t("demoNote")}</p>}
      </Block>

      <Block title={t("nameTitle")}>
        <p className="leading-relaxed text-muted">{t("name")}</p>
      </Block>

      <footer className="border-t border-line pt-6 text-sm text-muted">
        {t("feedback")}{" "}
        {SITE.feedbackUrl && (
          <a
            href={SITE.feedbackUrl}
            className="font-medium text-accent hover:underline"
            rel="noopener"
          >
            {t("feedbackLink")}
          </a>
        )}
      </footer>
    </article>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-faint">{title}</h2>
      {children}
    </section>
  );
}

/** A list that reads as sentences rather than as a bulleted pitch. */
function Points({ items, muted = false }: { items: string[]; muted?: boolean }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3 leading-relaxed">
          <span
            className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
            aria-hidden="true"
          />
          <span className={muted ? "text-muted" : undefined}>{item}</span>
        </li>
      ))}
    </ul>
  );
}
