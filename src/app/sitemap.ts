import type { MetadataRoute } from "next";
import { getRepository } from "@/lib/data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const repo = await getRepository();
  const [competitions, teams] = await Promise.all([repo.listCompetitions(), repo.listTeams()]);
  return [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/leagues`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/teams`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.3 },
    ...competitions.flatMap((c) =>
      ["", "/fixtures", "/results", "/stats", "/history"].map((s) => ({
        url: `${base}/leagues/${c.slug}${s}`,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
    ),
    ...teams.map((t) => ({
      url: `${base}/teams/${t.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
