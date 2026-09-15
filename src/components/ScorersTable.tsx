import Link from "next/link";
import type { Player, ScorerRow, Team } from "@/lib/types";
import { TeamCrest } from "./TeamCrest";

export function ScorersTable({
  rows,
  players,
  teams,
  compact = false,
}: {
  rows: ScorerRow[];
  players: Map<string, Player>;
  teams: Map<string, Team>;
  compact?: boolean;
}) {
  if (rows.length === 0)
    return <div className="card px-6 py-10 text-center text-sm text-muted">No goals yet.</div>;
  return (
    <div className="card overflow-hidden">
      <table className="tnum w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
            <th className="w-8 py-2.5 ps-4 font-medium">#</th>
            <th className="py-2.5 font-medium">Player</th>
            {!compact && (
              <th className="hidden w-12 py-2.5 text-center font-medium sm:table-cell">Apps</th>
            )}
            {!compact && (
              <th className="hidden w-12 py-2.5 text-center font-medium sm:table-cell">Pens</th>
            )}
            <th className="w-12 py-2.5 text-center font-medium">Ast</th>
            <th className="w-14 py-2.5 pe-4 text-center font-semibold text-ink">Goals</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const p = players.get(r.playerId);
            const t = teams.get(r.teamId);
            if (!p || !t) return null;
            return (
              <tr key={r.playerId} className="row-hover border-b border-line last:border-0">
                <td className="py-2 ps-4 text-muted">{i + 1}</td>
                <td className="py-2">
                  <Link
                    href={`/players/${p.slug}`}
                    className="flex items-center gap-2.5 hover:underline"
                  >
                    <TeamCrest team={t} size={22} />
                    <span className="flex flex-col leading-tight">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-muted">{t.shortName}</span>
                    </span>
                  </Link>
                </td>
                {!compact && (
                  <td className="hidden py-2 text-center text-muted sm:table-cell">
                    {r.appearances}
                  </td>
                )}
                {!compact && (
                  <td className="hidden py-2 text-center text-muted sm:table-cell">
                    {r.penalties}
                  </td>
                )}
                <td className="py-2 text-center text-muted">{r.assists}</td>
                <td className="py-2 pe-4 text-center font-semibold">{r.goals}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
