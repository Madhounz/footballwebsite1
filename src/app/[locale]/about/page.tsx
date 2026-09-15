import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Mark } from "@/components/Logo";
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
  return (
    <article className="mx-auto max-w-2xl space-y-10">
      <header className="space-y-4">
        <Mark size={48} className="text-ink" />
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-lg leading-relaxed text-muted">{t("lead")}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">{t("whyTitle")}</h2>
        <p className="leading-relaxed">{t("why")}</p>
        <ul className="list-disc space-y-1 ps-5 leading-relaxed">
          <li>{t("why1")}</li>
          <li>{t("why2")}</li>
          <li>{t("why3")}</li>
          <li>{t("why4")}</li>
        </ul>
      </section>

      <section
        className="space-y-3 rounded-2xl border border-dashed border-line-strong p-5"
        id="testing"
      >
        <h2 className="text-xl font-semibold tracking-tight">{t("testingTitle")}</h2>
        <p className="leading-relaxed">{t("testing")}</p>
        <p className="leading-relaxed text-muted">
          {t("feedback")}{" "}
          {SITE.feedbackUrl && (
            <a href={SITE.feedbackUrl} className="text-accent hover:underline" rel="noopener">
              {t("feedbackLink")}
            </a>
          )}
        </p>
      </section>

      <section className="space-y-3" id="data">
        <h2 className="text-xl font-semibold tracking-tight">{t("dataTitle")}</h2>
        <p className="leading-relaxed">{t("data")}</p>
        <ol className="list-decimal space-y-2 ps-5 leading-relaxed">
          {(["step1", "step2", "step3", "step4", "step5"] as const).map((k) => (
            <li key={k}>
              <span className="font-medium">{t(k)}</span> {t(`${k}t`)}
            </li>
          ))}
        </ol>
        <p className="text-sm leading-relaxed text-muted">{t("demoNote")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">{t("nameTitle")}</h2>
        <p className="leading-relaxed">{t("name")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">{t("nextTitle")}</h2>
        <ul className="list-disc space-y-1 ps-5 leading-relaxed">
          {(["next1", "next2", "next3", "next4", "next5"] as const).map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
