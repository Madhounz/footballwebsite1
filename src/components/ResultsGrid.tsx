import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { ResultsGrid as Grid } from "@/lib/data/grid";
import { teamShortName } from "@/lib/i18n/names";
import type { Team } from "@/lib/types";
import { TeamCrest } from "./TeamCrest";

/**
 * The whole season as one square: home down the side, away across the top.
 *
 * A results list answers "what happened on Saturday". This answers the
 * questions that take a season to ask — who takes points off the clubs above
 * them, whose home record carries them, the column nobody has won in. Reading
 * a row gives a club's home season; reading a column gives every visit to it.
 *
 * Twenty columns do not fit a phone and never will, so the square scrolls
 * sideways with the club names pinned. That is the honest answer: a grid
 * squeezed until its cells are unreadable is not a smaller grid, it is a
 * worse one.
 */
const TONE: Record<"W" | "D" | "L", string> = {
  W: "bg-[color-mix(in_srgb,var(--win)_16%,transparent)] text-ink",
  D: "bg-surface-2 text-muted",
  L: "bg-[color-mix(in_srgb,var(--loss)_16%,transparent)] text-ink",
};

export async function ResultsGrid({ grid, teams }: { grid: Grid; teams: Map<string, Team> }) {
  const t = await getTranslations("league");
  const locale = await getLocale();
  const ids = grid.teamIds.filter((id) => teams.has(id));
  if (ids.length < 3) return null;

  return (
    <div className="card overflow-hidden">
      <div className="scrollbar-none overflow-x-auto">
        <table className="tnum w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th
                className="sticky start-0 z-10 bg-surface p-2 text-start text-[10px] font-medium uppercase tracking-wide text-faint"
                scope="col"
              >
                {t("gridHome")}
              </th>
              {ids.map((id) => {
                const team = teams.get(id)!;
                return (
                  <th
                    key={id}
                    scope="col"
                    className="p-1 text-center text-[10px] font-medium text-faint"
                    title={teamShortName(team, locale)}
                  >
                    {team.code.slice(0, 3)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ids.map((homeId) => {
              const home = teams.get(homeId)!;
              return (
                <tr key={homeId} className="border-t border-line">
                  <th
                    scope="row"
                    className="sticky start-0 z-10 max-w-[9rem] bg-surface p-2 text-start font-medium"
                  >
                    <Link
                      href={`/teams/${home.slug}`}
                      className="flex items-center gap-1.5 hover:underline"
                    >
                      <TeamCrest team={home} size={16} />
                      <span className="truncate">{teamShortName(home, locale)}</span>
                    </Link>
                  </th>
                  {ids.map((awayId) => {
                    if (awayId === homeId) {
                      return (
                        <td key={awayId} className="bg-surface-2/40 p-0" aria-hidden="true">
                          <span className="block h-7 w-11" />
                        </td>
                      );
                    }
                    const cell = grid.cells.get(`${homeId}:${awayId}`);
                    const away = teams.get(awayId)!;
                    if (!cell) {
                      return (
                        <td key={awayId} className="p-0 text-center text-faint">
                          <span className="block h-7 w-11 leading-7">·</span>
                        </td>
                      );
                    }
                    return (
                      <td key={awayId} className="p-0 text-center">
                        <Link
                          href={`/match/${cell.slug}`}
                          dir="ltr"
                          className={`block h-7 w-11 leading-7 transition-opacity hover:opacity-70 ${TONE[cell.result]}`}
                          title={`${teamShortName(home, locale)} ${cell.home}–${cell.away} ${teamShortName(away, locale)}`}
                        >
                          {cell.home}–{cell.away}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-2 text-[11px] text-faint">{t("gridNote")}</p>
    </div>
  );
}
