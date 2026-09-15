import type { MetadataRoute } from "next";
import { getRepository } from "@/lib/data";
import { SITE } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url;
  const repo = await getRepository();
  const [competitions, teams] = await Promise.all([repo.listCompetitions(), repo.listTeams()]);
  const paths: {
    path: string;
    changeFrequency: "hourly" | "daily" | "weekly" | "monthly";
    priority: number;
  }[] = [
    { path: "/", changeFrequency: "hourly", priority: 1 },
    { path: "/leagues", changeFrequency: "daily", priority: 0.8 },
    { path: "/teams", changeFrequency: "weekly", priority: 0.5 },
    { path: "/about", changeFrequency: "monthly", priority: 0.3 },
    ...competitions.flatMap((c) =>
      ["", "/fixtures", "/results", "/stats", "/history"].map((s) => ({
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
