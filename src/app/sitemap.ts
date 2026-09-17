import type { MetadataRoute } from "next";
import { getRepository } from "@/lib/data";
import { addDays, dateOf, todayISO } from "@/lib/dates";
import { SITE } from "@/lib/site";

/** Crawlers can ask often; the list does not need to be minute-fresh. */
export const revalidate = 3600;

/**
 * Match pages are the ones people search for — "arsenal vs chelsea" — so they
 * belong here, not just in the internal links. The window is wide enough to
 * cover a season's worth of interest without listing every fixture ever played.
 */
const MATCH_DAYS_BACK = 120;
const MATCH_DAYS_AHEAD = 45;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url;
  const repo = await getRepository();
  const [competitions, teams, players] = await Promise.all([
    repo.listCompetitions(),
    repo.listTeams(),
    repo.listPlayers(),
  ]);
  const today = todayISO();
  const from = addDays(today, -MATCH_DAYS_BACK);
  const to = addDays(today, MATCH_DAYS_AHEAD);
  const matches = (
    await Promise.all(competitions.map((c) => repo.getCompetitionMatches(c.id)))
  ).flat();
  const honours = new Set(
    (
      await Promise.all(
        competitions.map(async (c) => ((await repo.getHonours(c.id)) ? c.id : null)),
      )
    ).filter((id): id is string => id !== null),
  );

  const paths: {
    path: string;
    changeFrequency: "hourly" | "daily" | "weekly" | "monthly";
    priority: number;
  }[] = [
    { path: "/", changeFrequency: "hourly", priority: 1 },
    { path: "/leagues", changeFrequency: "daily", priority: 0.8 },
    { path: "/scorers", changeFrequency: "daily", priority: 0.7 },
    { path: "/teams", changeFrequency: "weekly", priority: 0.5 },
    { path: "/about", changeFrequency: "monthly", priority: 0.3 },
    ...competitions.flatMap((c) =>
      // The same sections the competition's own tabs offer — history only
      // where there is a curated honours file behind it, so the sitemap never
      // sends a crawler to a page that says "nothing here yet".
      [
        "",
        "/fixtures",
        "/results",
        "/race",
        "/run-in",
        "/halves",
        "/stats",
        ...(honours.has(c.id) ? ["/history"] : []),
      ].map((s) => ({
        path: `/leagues/${c.slug}${s}`,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
    ),
    ...teams.map((t) => ({
      path: `/teams/${t.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...matches
      .filter((v) => {
        const day = dateOf(v.match.kickoff);
        return day >= from && day <= to;
      })
      .map((v) => ({
        path: `/match/${v.match.slug}`,
        // A finished match is settled; one still to come changes with the news.
        changeFrequency: (v.match.status === "finished" ? "weekly" : "daily") as "weekly" | "daily",
        priority: v.match.status === "finished" ? 0.6 : 0.7,
      })),
    ...players.map((p) => ({
      path: `/players/${p.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ];
  return paths.map((p) => ({
    url: `${base}${p.path}`,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
    alternates: {
      languages: { en: `${base}${p.path}`, ar: `${base}/ar${p.path === "/" ? "" : p.path}` },
    },
  }));
}
