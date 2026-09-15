import type { Metadata } from "next";
import Link from "next/link";
import { StandingsTable } from "@/components/StandingsTable";
import { getRepository } from "@/lib/data";

export const metadata: Metadata = { title: "Leagues & competitions" };

export default async function LeaguesPage() {
  const repo = await getRepository();
  const competitions = await repo.listCompetitions();
  const blocks = await Promise.all(
    competitions.map(async (c) => {
      const [standings, teams] = await Promise.all([repo.getStandings(c.id), repo.listTeams(c.id)]);
      return {
        c,
        standings: { ...standings, rows: standings.rows.slice(0, 6) },
        teams: new Map(teams.map((t) => [t.id, t])),
      };
    }),
  );
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Leagues & competitions</h1>
        <p className="text-sm text-muted">
          Six competitions, followed properly. Pick one for the full table, fixtures, results,
          scorers and history.
        </p>
      </header>
      <div className="grid gap-5 md:grid-cols-2">
        {blocks.map(({ c, standings, teams }) => (
          <section key={c.id} className="space-y-2">
            <Link href={`/leagues/${c.slug}`} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-base font-semibold hover:underline">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: c.color }}
                  aria-hidden="true"
                />
                {c.name}
                <span className="text-sm font-normal text-faint">
                  {c.country} · {c.season}
                </span>
              </span>
              <span className="text-sm text-muted">Full table →</span>
            </Link>
            <StandingsTable standings={standings} competition={c} teams={teams} compact />
          </section>
        ))}
      </div>
    </div>
  );
}
