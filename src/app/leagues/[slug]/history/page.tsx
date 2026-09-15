import Link from "next/link";
import { notFound } from "next/navigation";
import { Empty, Section } from "@/components/Section";
import { TeamCrest } from "@/components/TeamCrest";
import { getRepository } from "@/lib/data";

export default async function HistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const repo = await getRepository();
  const c = await repo.getCompetitionBySlug((await params).slug);
  if (!c) notFound();
  const [honours, teams] = await Promise.all([repo.getHonours(c.id), repo.listTeams()]);
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  if (!honours) return <Empty>No history recorded yet.</Empty>;
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <Section title="Past winners" action={<span>{honours.entries.length} seasons</span>}>
        <div className="card overflow-hidden">
          <table className="tnum w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="w-24 py-2.5 ps-4 font-medium">Season</th>
                <th className="py-2.5 font-medium">Winner</th>
                <th className="hidden py-2.5 font-medium sm:table-cell">Runner-up</th>
                <th className="hidden py-2.5 pe-4 font-medium md:table-cell">Note</th>
              </tr>
            </thead>
            <tbody>
              {honours.entries.map((e) => {
                const w = e.winnerTeamId ? teamMap.get(e.winnerTeamId) : undefined;
                const r = e.runnerUpTeamId ? teamMap.get(e.runnerUpTeamId) : undefined;
                return (
                  <tr key={e.season} className="row-hover border-b border-line last:border-0">
                    <td className="py-2 ps-4 text-muted">{e.season}</td>
                    <td className="py-2 font-medium">
                      {w ? (
                        <Link
                          href={`/teams/${w.slug}`}
                          className="inline-flex items-center gap-2 hover:underline"
                        >
                          <TeamCrest team={w} size={20} /> {e.winner}
                        </Link>
                      ) : (
                        e.winner
                      )}
                    </td>
                    <td className="hidden py-2 text-muted sm:table-cell">
                      {r ? (
                        <Link href={`/teams/${r.slug}`} className="hover:underline">
                          {e.runnerUp}
                        </Link>
                      ) : (
                        (e.runnerUp ?? "—")
                      )}
                    </td>
                    <td className="hidden py-2 pe-4 text-xs text-muted md:table-cell">
                      {e.detail ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {"note" in honours && typeof (honours as { note?: string }).note === "string" && (
            <div className="border-t border-line px-4 py-2 text-xs text-faint">
              {(honours as { note?: string }).note}
            </div>
          )}
        </div>
      </Section>
      <Section title="Most titles">
        <div className="card overflow-hidden">
          <ol className="tnum divide-y divide-line text-sm">
            {honours.mostTitles.map((m, i) => {
              const t = m.teamId ? teamMap.get(m.teamId) : undefined;
              return (
                <li key={m.team} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-4 text-faint">{i + 1}</span>
                  {t ? (
                    <TeamCrest team={t} size={20} />
                  ) : (
                    <span className="inline-block h-5 w-5 rounded-full bg-surface-2" />
                  )}
                  <span className="flex-1 truncate">
                    {t ? (
                      <Link href={`/teams/${t.slug}`} className="hover:underline">
                        {m.team}
                      </Link>
                    ) : (
                      m.team
                    )}
                  </span>
                  <span className="font-semibold">{m.count}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </Section>
    </div>
  );
}
