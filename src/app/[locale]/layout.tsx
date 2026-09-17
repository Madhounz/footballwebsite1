import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import "../globals.css";
import { BottomNav } from "@/components/BottomNav";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ServiceWorker } from "@/components/ServiceWorker";
import { getRepository } from "@/lib/data";
import { isRtl, routing } from "@/i18n/routing";
import { SITE } from "@/lib/site";
import { competitionName, teamName, teamShortName } from "@/lib/i18n/names";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE.url),
    title: { default: t("title"), template: "%s · ninety" },
    description: await coverageLine(locale, t),
    applicationName: "ninety",
    openGraph: {
      siteName: "ninety",
      type: "website",
      locale: locale === "ar" ? "ar_EG" : "en_GB",
      // The address the card belongs to. A crawler that is handed a link with
      // a tracking parameter on it still files the preview under this one.
      url: locale === "ar" ? `${SITE.url}/ar` : SITE.url,
    },
    // Pages set their own canonical through `pageMeta`; this covers the rest.
    alternates: {
      canonical: locale === "ar" ? `${SITE.url}/ar` : SITE.url,
      languages: { en: "/", ar: "/ar", "x-default": "/" },
    },
    twitter: { card: "summary_large_image" },
  };
}

/**
 * What the site covers, in one sentence, built from what it actually holds.
 *
 * This is the line search engines and chat apps print under the link, and it
 * was a list of five competitions typed out by hand — which is exactly the
 * kind of sentence that is still saying five a year after it became eleven.
 * The first few are named because a name is what somebody searches for; the
 * rest are counted, so the sentence stays a sentence.
 */
const NAMED = 4;

async function coverageLine(
  locale: string,
  t: Awaited<ReturnType<typeof getTranslations<"meta">>>,
): Promise<string> {
  const competitions = await (await getRepository()).listCompetitions();
  if (competitions.length === 0) return t("descriptionPlain");
  const named = competitions.slice(0, NAMED).map((c) => competitionName(c, locale));
  const rest = competitions.length - named.length;
  if (rest > 0) named.push(t("andMore", { n: rest }));
  const list = new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(named);
  return t("description", { competitions: list });
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e3e2dc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0e" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * The reader's theme, from the cookie the toggle writes.
 *
 * It has to be rendered by the server rather than set by a script, because
 * switching language re-renders this `<html>` element on the client: React
 * writes back the attributes it knows about and drops the ones it does not, so
 * a theme applied only by script was wiped every time somebody tapped
 * العربية — chosen light, back to dark, preference still saved and ignored.
 * An attribute the server puts there is one React keeps.
 */
export const THEME_COOKIE = "ninety-theme";

/**
 * Still applied before first paint for anyone whose choice predates the
 * cookie, and harmless once the cookie agrees with it.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem("ninety:theme");if((t==="dark"||t==="light")&&!document.documentElement.getAttribute("data-theme")){document.documentElement.setAttribute("data-theme",t);document.cookie="ninety-theme="+t+";path=/;max-age=31536000;samesite=lax"}}catch(e){}`;

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const chosen = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = chosen === "light" || chosen === "dark" ? chosen : undefined;

  const repo = await getRepository();
  const [competitions, rawSearch, nav] = await Promise.all([
    repo.listCompetitions(),
    repo.searchIndex(),
    getTranslations({ locale, namespace: "nav" }),
  ]);
  const navLabels = {
    matches: nav("matches"),
    week: nav("week"),
    scorers: nav("scorers"),
    following: nav("following"),
    leagues: nav("leagues"),
    primary: nav("primary"),
  };
  const info = repo.info();
  // Localise search labels; keep English in keywords so either script matches.
  const searchItems = rawSearch.map((item) => {
    if (item.type !== "team") return item;
    const name = teamName({ id: item.id, name: item.label }, locale);
    const short = teamShortName({ id: item.id, shortName: item.label }, locale);
    return { ...item, label: name, keywords: [...item.keywords, item.label, short] };
  });

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      data-theme={theme}
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <SiteHeader
            competitions={competitions}
            searchItems={searchItems}
            demo={info.kind === "demo"}
          />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-8 pt-6 sm:px-6">{children}</main>
          <SiteFooter info={info} />
          {/* Under the thumb on a phone, absent on anything wider. */}
          <BottomNav labels={navLabels} />
          <div className="bottom-nav-gap md:hidden" aria-hidden="true" />
          <ServiceWorker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
