import Link from "next/link";
import type { Competition, Standings, TableZone, Team } from "@/lib/types";
import { signed } from "@/lib/format";
import { FormBadges } from "./Form";
import { TeamCrest } from "./TeamCrest";

const TONE: Record<TableZone["tone"], string> = {
  top: "bg-accent",
  second: "bg-sky-500",
  third: "bg-amber-500",
  bottom: "bg-loss",
};

function zoneFor(pos: number, zones: TableZone[]): TableZone | undefined {
  return zones.find((z) => pos >= z.from && pos <= z.to);
}

export function StandingsTable({
  standings,
  competition,
  teams,
  highlightTeamId,
  compact = false,
}: {
  standings: Standings;
  competition: Competition;
  teams: Map<string, Team>;
  highlightTeamId?: string;
  compact?: boolean;
}) {
  const zonesUsed = competition.zones.filter((z) =>
    standings.rows.some((r) => r.position >= z.from && r.position <= z.to),
  );
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="tnum w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
              <th className="w-10 py-2.5 ps-3 font-medium sm:ps-4">#</th>
              <th className="py-2.5 font-medium">Club</th>
              <th className="w-9 py-2.5 text-center font-medium">P</th>
              {!compact && (
                <>
                  <th className="hidden w-9 py-2.5 text-center font-medium sm:table-cell">W</th>
                  <th className="hidden w-9 py-2.5 text-center font-medium sm:table-cell">D</th>
                  <th className="hidden w-9 py-2.5 text-center font-medium sm:table-cell">L</th>
                  <th className="hidden w-16 py-2.5 text-center font-medium md:table-cell">
                    GF:GA
                  </th>
                </>
              )}
              <th className="w-10 py-2.5 text-center font-medium">GD</th>
              <th className="w-12 py-2.5 pe-3 text-center font-semibold text-ink sm:pe-4">Pts</th>
              {!compact && (
                <th className="hidden w-28 py-2.5 pe-4 text-end font-medium lg:table-cell">Form</th>
              )}
            </tr>
          </thead>
          <tbody>
            {standings.rows.map((r) => {
              const team = teams.get(r.teamId);
              if (!team) return null;
              const zone = zoneFor(r.position, competition.zones);
              const highlighted = r.teamId === highlightTeamId;
              return (
                <tr
                  key={r.teamId}
                  className={`row-hover border-b border-line last:border-0 ${highlighted ? "bg-accent-soft/60" : ""}`}
                >
                  <td className="relative py-2 ps-3 sm:ps-4">
                    {zone && (
                      <span
                        className={`absolute inset-y-0 start-0 w-[3px] ${TONE[zone.tone]}`}
                        aria-hidden="true"
                      />
                    )}
                    <span className="inline-flex items-center gap-1">
                      <span className="w-5 text-muted">{r.position}</span>
                      {r.movement !== 0 && r.played > 1 && (
                        <span
                          className={`text-[10px] ${r.movement > 0 ? "text-win" : "text-loss"}`}
                          aria-label={r.movement > 0 ? "up" : "down"}
                        >
                          {r.movement > 0 ? "▲" : "▼"}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-2">
                    <Link
                      href={`/teams/${team.slug}`}
                      className="flex items-center gap-2.5 hover:underline"
                    >
                      <TeamCrest team={team} size={22} />
                      <span className="truncate font-medium">
                        <span className="hidden sm:inline">{team.name}</span>
                        <span className="sm:hidden">{team.shortName}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="py-2 text-center text-muted">{r.played}</td>
                  {!compact && (
                    <>
                      <td className="hidden py-2 text-center text-muted sm:table-cell">{r.won}</td>
                      <td className="hidden py-2 text-center text-muted sm:table-cell">
                        {r.drawn}
                      </td>
                      <td className="hidden py-2 text-center text-muted sm:table-cell">{r.lost}</td>
                      <td className="hidden py-2 text-center text-muted md:table-cell">
                        {r.goalsFor}:{r.goalsAgainst}
                      </td>
                    </>
                  )}
                  <td className="py-2 text-center text-muted">{signed(r.goalDifference)}</td>
                  <td className="py-2 pe-3 text-center font-semibold sm:pe-4">{r.points}</td>
                  {!compact && (
                    <td className="hidden py-2 pe-4 text-end lg:table-cell">
                      <FormBadges form={r.form} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!compact && zonesUsed.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-[11px] text-muted">
          {zonesUsed.map((z) => (
            <span key={z.label} className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-sm ${TONE[z.tone]}`} /> {z.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
