import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { teamShortName } from "@/lib/i18n/names";
import { TeamCrest } from "./TeamCrest";
import type { StandingRow, Team } from "@/lib/types";

/**
 * The table, and the table of second halves, with a line between them.
 *
 * Both columns are real tables of the same season — one of the ninety minutes,
 * one of the forty-five after the break. A club that plays the same football
 * throughout has a flat line. Everything else is the story: the side sitting
 * ninth who are second once the game settles, the side who lead every first
 * half and finish mid-table.
 *
 * Rising in green and falling in red, because that is what the reader is here
 * to see, and because those are the two colours this site already uses for
 * exactly that. The lines curve rather than cut across, so twenty of them
 * crossing still reads as twenty lines.
 */
const W = 640;
const PAD_Y = 12;
const ROW = 11;
const LEFT = 52;
const RIGHT = 588;

export async function HalfSlope({
  table,
  half,
  teams,
}: {
  /** The real table, in order. */
  table: StandingRow[];
  /** The same clubs as the second half alone leaves them. */
  half: StandingRow[];
  teams: Map<string, Team>;
}) {
  const t = await getTranslations("league");
  const locale = await getLocale();
  const halfBy = new Map(half.map((r) => [r.teamId, r]));
  const rows = table.filter((r) => halfBy.has(r.teamId));
  if (rows.length < 3) return null;

  const places = Math.max(rows.length, ...rows.map((r) => r.position));
  const H = Math.min(430, Math.max(150, places * ROW)) + PAD_Y;
  const step = places > 1 ? (H - PAD_Y * 2) / (places - 1) : 0;
  const y = (position: number) => PAD_Y + step * (position - 1);

  // A phone cannot show twenty labelled lines: at that width the labels shrink
  // past reading and the chart becomes twenty anonymous curves. It gets the
  // same finding as a list instead — the clubs that actually moved, and by how
  // much — which is what the chart is for.
  const movers = rows
    .map((r) => ({
      row: r,
      to: halfBy.get(r.teamId)!,
      change: r.position - halfBy.get(r.teamId)!.position,
    }))
    .filter((m) => m.change !== 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || a.to.position - b.to.position);

  return (
    <div className="card px-3 py-3 sm:px-4" dir="ltr">
      <ul className="divide-y divide-line sm:hidden" dir="auto">
        {movers.map((m) => {
          const team = teams.get(m.row.teamId);
          if (!team) return null;
          const up = m.change > 0;
          return (
            <li key={m.row.teamId}>
              <Link
                href={`/teams/${team.slug}`}
                className="row-hover -mx-1 flex items-center gap-2.5 px-1 py-2"
              >
                <TeamCrest team={team} size={22} />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {teamShortName(team, locale)}
                </span>
                <span className="tnum text-xs text-faint" dir="ltr">
                  {m.row.position} → {m.to.position}
                </span>
                <span
                  className={`tnum flex w-9 items-center justify-end gap-0.5 text-sm font-semibold ${up ? "text-win" : "text-loss"}`}
                >
                  <span aria-hidden="true">{up ? "▲" : "▼"}</span>
                  {Math.abs(m.change)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mb-1 hidden justify-between px-1 text-[11px] font-medium uppercase tracking-wide text-faint sm:flex">
        <span>{t("slopeLeft")}</span>
        <span>{t("slopeRight")}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart hidden h-auto w-full sm:block"
        role="img"
        aria-label={t("slopeAria", { n: rows.length })}
      >
        {rows.map((row, i) => {
          const to = halfBy.get(row.teamId);
          const team = teams.get(row.teamId);
          if (!to) return null;
          const change = row.position - to.position;
          const y0 = y(row.position);
          const y1 = y(to.position);
          const colour =
            change > 0 ? "var(--win)" : change < 0 ? "var(--loss)" : "var(--text-faint)";
          const weight = Math.min(4, 1.5 + Math.abs(change) * 0.35);
          // A curve rather than a straight cut: twenty of them crossing at
          // once is a knot, and the eye follows a bend better than a corner.
          const mid = (LEFT + RIGHT) / 2;
          const d = `M ${LEFT} ${y0} C ${mid} ${y0}, ${mid} ${y1}, ${RIGHT} ${y1}`;
          return (
            <g key={row.teamId} className="chart-line">
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth="12"
                pointerEvents="stroke"
              />
              <path
                className="chart-stroke arc-line"
                style={{ animationDelay: `${i * 45}ms` }}
                d={d}
                fill="none"
                stroke={colour}
                strokeOpacity={change === 0 ? 0.4 : 0.9}
                strokeWidth={weight}
                strokeLinecap="round"
                pathLength={1}
              />
              <circle cx={LEFT} cy={y0} r="2.5" fill={colour} fillOpacity="0.9" />
              <circle cx={RIGHT} cy={y1} r="3.5" fill={colour} fillOpacity="0.9" />
              {team && (
                <>
                  <text
                    className="chart-endlabel"
                    x={LEFT - 6}
                    y={y0 + 3}
                    textAnchor="end"
                    fill="var(--text-muted)"
                    fontSize="8.5"
                  >
                    {row.position} {team.code.slice(0, 3)}
                  </text>
                  <text
                    className="chart-endlabel"
                    x={RIGHT + 6}
                    y={y1 + 3}
                    fill={change === 0 ? "var(--text-muted)" : colour}
                    fontSize="8.5"
                    fontWeight={change === 0 ? 400 : 600}
                  >
                    {to.position} {team.code.slice(0, 3)}
                  </text>
                </>
              )}
              <title>
                {`${team ? teamShortName(team, locale) : row.teamId} — ${t("slopeMove", {
                  from: row.position,
                  to: to.position,
                })}`}
              </title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
