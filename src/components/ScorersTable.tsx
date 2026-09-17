import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Player, ScorerRow, Team } from "@/lib/types";
import { teamShortName } from "@/lib/i18n/names";
import { TeamCrest } from "./TeamCrest";

export async function ScorersTable({
  rows,
  players,
  teams,
  compact = false,
  rankBy = "goals",
}: {
  rows: ScorerRow[];
  players: Map<string, Player>;
  teams: Map<string, Team>;
  compact?: boolean;
  /**
   * What the list is ordered by. That column is the emphasised one and sits
   * last, so the number the eye lands on is the number the table is about —
   * an assists chart that shouts its goals column is telling the reader the
   * wrong thing.
   */
  rankBy?: "goals" | "assists";
}) {
  const t = await getTranslations("league");
  const locale = await getLocale();
  if (rows.length === 0)
    return <div className="card px-6 py-10 text-center text-sm text-muted">{t("noGoals")}</div>;
  return (
    <div className="card overflow-hidden">
      <table className="tnum w-full text-sm">
        <thead>
          <tr className="border-b border-line text-start text-[11px] uppercase tracking-wide text-faint">
            <th className="w-11 py-2.5 pe-2 ps-4 text-start font-medium">{t("th.pos")}</th>
            <th className="py-2.5 text-start font-medium">{t("th.player")}</th>
            {!compact && (
              <th className="hidden w-12 py-2.5 text-center font-medium sm:table-cell">
                {t("th.apps")}
              </th>
            )}
            {!compact && (
              <th className="hidden w-12 py-2.5 text-center font-medium sm:table-cell">
                {t("th.pens")}
              </th>
            )}
            <th className="w-12 py-2.5 text-center font-medium">
              {rankBy === "goals" ? t("th.ast") : t("th.goals")}
            </th>
            <th className="w-14 py-2.5 pe-4 text-center font-semibold text-ink">
              {rankBy === "goals" ? t("th.goals") : t("th.ast")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const p = players.get(r.playerId);
            const team = teams.get(r.teamId);
            if (!p || !team) return null;
            return (
              <tr key={r.playerId} className="row-hover border-b border-line last:border-0">
                <td className="py-2 pe-2 ps-4 text-muted">{i + 1}</td>
                <td className="py-2">
                  <Link
                    href={`/players/${p.slug}`}
                    className="flex items-center gap-2.5 hover:underline"
                  >
                    <TeamCrest team={team} size={22} />
                    <span className="flex flex-col leading-tight">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-muted">{teamShortName(team, locale)}</span>
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
                <td className="py-2 text-center text-muted">
                  {rankBy === "goals" ? r.assists : r.goals}
                </td>
                <td className="py-2 pe-4 text-center font-semibold">
                  {rankBy === "goals" ? r.goals : r.assists}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
