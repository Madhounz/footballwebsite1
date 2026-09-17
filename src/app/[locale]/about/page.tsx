import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Mark } from "@/components/Logo";
import { getRepository } from "@/lib/data";
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

export default async function AboutPage() {
  const t = await getTranslations("about");
  const locale = await getLocale();
  const repo = await getRepository();
  // What the site covers is not a sentence anybody should be maintaining. Both
  // repositories list only competitions that actually hold matches, so this is
  // the same list the navigation is built from: it cannot claim a competition
  // the site does not have, and it names a new one the day its fixtures land.
  const competitions = await repo.listCompetitions();
  const covered = new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(
    competitions.map((c) => competitionName(c, locale)),
  );

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
          items={[t("here1", { count: competitions.length }), t("here2"), t("here3"), t("here4")]}
        />
      </Block>

      <Block title={t("testingTitle")}>
        <p className="leading-relaxed text-muted">{t("testing", { competitions: covered })}</p>
      </Block>

      <Block title={t("nextTitle")}>
        <Points items={[t("next1"), t("next2"), t("next3"), t("next4")]} muted />
      </Block>

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
