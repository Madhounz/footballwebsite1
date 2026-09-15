import type { Metadata } from "next";
import Link from "next/link";
import { TeamCrest } from "@/components/TeamCrest";
import { getRepository } from "@/lib/data";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage() {
  const repo = await getRepository();
  const [competitions, teams] = await Promise.all([repo.listCompetitions(), repo.listTeams()]);
  const leagues = competitions.filter((c) => c.kind === "league");
  const others = teams.filter((t) => !t.leagueId);
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
        <p className="text-sm text-muted">
          Every club in the tracked leagues, plus the European sides they meet in UEFA competition.
        </p>
      </header>
      {leagues.map((c) => (
        <section key={c.id} className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: c.color }}
              aria-hidden="true"
            />
            {c.name}
          </h2>
          <Grid teams={teams.filter((t) => t.leagueId === c.id)} />
        </section>
      ))}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Other European clubs</h2>
        <Grid teams={others} />
      </section>
    </div>
  );
}

function Grid({
  teams,
}: {
  teams: Awaited<ReturnType<Awaited<ReturnType<typeof getRepository>>["listTeams"]>>;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {teams.map((t) => (
        <li key={t.id}>
          <Link
            href={`/teams/${t.slug}`}
            className="card row-hover flex items-center gap-3 px-3 py-2.5"
          >
            <TeamCrest team={t} size={30} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{t.name}</span>
              <span className="block truncate text-xs text-muted">{t.city}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
