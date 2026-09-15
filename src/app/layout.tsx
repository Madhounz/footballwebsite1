import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getRepository } from "@/lib/data";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ninety — scores, tables and squads without the noise",
    template: "%s · ninety",
  },
  description:
    "Live scores, standings, fixtures, squads and history for the Premier League, La Liga, Bundesliga, Serie A, Champions League and Europa League.",
  applicationName: "ninety",
  openGraph: { siteName: "ninety", type: "website" },
};

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const repo = await getRepository();
  const [competitions, searchItems] = await Promise.all([
    repo.listCompetitions(),
    repo.searchIndex(),
  ]);
  const info = repo.info();
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <SiteHeader
          competitions={competitions}
          searchItems={searchItems}
          demo={info.kind === "demo"}
        />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-8 pt-6 sm:px-6">{children}</main>
        <SiteFooter info={info} />
      </body>
    </html>
  );
}
