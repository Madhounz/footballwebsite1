import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Tabs } from "@/components/Tabs";
import { getRepository } from "@/lib/data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const repo = await getRepository();
  const c = await repo.getCompetitionBySlug((await params).slug);
  if (!c) return {};
  return {
    title: `${c.name} ${c.season}`,
    description: `${c.name} table, fixtures, results, top scorers and past winners.`,
  };
}

export default async function LeagueLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const repo = await getRepository();
  const { slug } = await params;
  const c = await repo.getCompetitionBySlug(slug);
  if (!c) notFound();
  const base = `/leagues/${c.slug}`;
  const live = (await repo.getLiveMatches()).filter((v) => v.competition.id === c.id).length;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-faint">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: c.color }}
              aria-hidden="true"
            />
            {c.country} · {c.kind === "cup" ? "UEFA club competition" : "Top flight"}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{c.name}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          {live > 0 && (
            <span className="flex items-center gap-1.5 font-medium text-live">
              <span className="live-dot" /> {live} live
            </span>
          )}
          <span>Season {c.season}</span>
        </div>
      </header>
      <Tabs
        ariaLabel={`${c.name} sections`}
        tabs={[
          { href: base, label: "Table", exact: true },
          { href: `${base}/fixtures`, label: "Fixtures" },
          { href: `${base}/results`, label: "Results" },
          { href: `${base}/stats`, label: "Top scorers" },
          { href: `${base}/history`, label: "History" },
        ]}
      />
      {children}
    </div>
  );
}
