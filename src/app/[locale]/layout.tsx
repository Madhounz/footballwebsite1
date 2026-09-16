import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
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
    openGraph: { siteName: "ninety", type: "website", locale: locale === "ar" ? "ar_EG" : "en_GB" },
    // Pages set their own canonical through `pageMeta`; this covers the rest.
    alternates: { languages: { en: "/", ar: "/ar", "x-default": "/" } },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0e" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Applies the saved theme before first paint to avoid a flash.
const THEME_SCRIPT = `try{var t=localStorage.getItem("ninety:theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;

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
