import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import "../globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ServiceWorker } from "@/components/ServiceWorker";
import { getRepository } from "@/lib/data";
import { isRtl, routing } from "@/i18n/routing";
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
    description: t("description"),
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
    { media: "(prefers-color-scheme: light)", color: "#eae9e4" },
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
  const [competitions, rawSearch] = await Promise.all([
    repo.listCompetitions(),
    repo.searchIndex(),
  ]);
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
          <ServiceWorker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
