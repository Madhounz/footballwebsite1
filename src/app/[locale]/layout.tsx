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
import { coverageLine } from "@/lib/seo";
import { viewerToday } from "@/lib/viewer";
import { SITE } from "@/lib/site";
import { teamName, teamShortName } from "@/lib/i18n/names";

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
    description: await coverageLine(locale),
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

/**
 * Tells the server what day it is here.
 *
 * A matchday is a human day. At half past midnight in Warsaw it is the 18th,
 * and a front page that opens on the 17th because the server is in UTC is
 * wrong about the one thing it is for — especially beside kick-off times that
 * have always been rendered in the reader's own zone.
 *
 * The browser writes its zone into a cookie, and every render after that is
 * right. The one it is already looking at can only be fixed by fetching it
 * again, so when the served day and the real day disagree it reloads — once
 * per session, tracked in `sessionStorage`, because a reload that can repeat
 * is a reload loop.
 */
const TZ_SCRIPT = `try{var z=Intl.DateTimeFormat().resolvedOptions().timeZone;if(z)document.cookie="ninety-tz="+encodeURIComponent(z)+";path=/;max-age=31536000;samesite=lax";var mine=new Intl.DateTimeFormat("en-CA").format(new Date()),served=document.documentElement.getAttribute("data-today");if(served&&served!==mine){if(!sessionStorage.getItem("ninety:tz")){sessionStorage.setItem("ninety:tz","1");location.reload()}}else sessionStorage.removeItem("ninety:tz")}catch(e){}`;

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
  // What the server believes today is, so the browser can tell us we are wrong.
  const served = await viewerToday();

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
      data-today={served}
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: TZ_SCRIPT }} />
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
