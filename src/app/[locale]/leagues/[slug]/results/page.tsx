import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ResultsGrid } from "@/components/ResultsGrid";
import { RoundList } from "@/components/RoundList";
import { getRepository } from "@/lib/data";
import { resultsGrid } from "@/lib/data/grid";

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const t = await getTranslations("league");
  const repo = await getRepository();
  const c = await repo.getCompetitionBySlug((await params).slug);
  if (!c) notFound();
  const all = await repo.getCompetitionMatches(c.id);
  const views = all.filter((v) => v.match.status === "finished").reverse();
  // The square only means anything where everybody plays everybody, so a
  // knockout or a league phase is never offered one to stare at.
  const square = c.kind === "league";
  const grid = square && (await searchParams).view === "grid";
  // Rows in table order, so the square reads top to bottom the way the league
  // does. Fetched together rather than one after the other inside the markup.
  const [standings, teamList] = grid
    ? await Promise.all([repo.getStandings(c.id), repo.listTeams(c.id)])
    : [null, []];

  return (
    <div className="space-y-4">
      {square && views.length > 0 && (
        <div className="flex justify-end">
          <div className="inline-flex rounded-full border border-line p-0.5 text-xs">
            {(
              [
                { value: "list", label: t("viewList") },
                { value: "grid", label: t("viewGrid") },
              ] as const
            ).map((o) => {
              const active = (o.value === "grid") === grid;
              return (
                <Link
                  key={o.value}
                  href={
                    o.value === "grid"
                      ? `/leagues/${c.slug}/results?view=grid`
                      : `/leagues/${c.slug}/results`
                  }
                  aria-current={active ? "true" : undefined}
                  className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                    active ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {o.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
      {grid ? (
        <ResultsGrid
          grid={resultsGrid(
            all,
            (standings?.rows ?? []).map((r) => r.teamId),
          )}
          teams={new Map(teamList.map((team) => [team.id, team]))}
        />
      ) : (
        <RoundList
          views={views}
          competition={c}
          mode="results"
          emptyText={all.length === 0 ? t("noMatchesYet") : undefined}
        />
      )}
    </div>
  );
}
