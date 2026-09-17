import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AcrossRow } from "@/lib/data/across";
import { competitionName, teamShortName } from "@/lib/i18n/names";
import type { Competition, Player, Team } from "@/lib/types";
import { TeamCrest } from "./TeamCrest";

/**
 * One season's goals, whoever they were scored against.
 *
 * The bar is the point of the page. A total on its own invites the argument
 * this is meant to settle — how many of those were in the Champions League,
 * how many in a second division — so the bar answers it before it is asked:
 * one segment per competition, in that competition's own colour, widths in
 * proportion to the leader's total. The number is the sum; the bar is the
 * working.
 */
export async function AcrossTable({
  rows,
  players,
  teams,
  competitions,
}: {
  rows: AcrossRow[];
  players: Map<string, Pick<Player, "id" | "slug" | "name">>;
  teams: Map<string, Team>;
  competitions: Map<string, Competition>;
}) {
  const t = await getTranslations("scorers");
  const locale = await getLocale();
  const shown = rows.filter((r) => players.has(r.playerId) && teams.has(r.teamId));
  if (shown.length === 0)
    return <div className="card px-6 py-10 text-center text-sm text-muted">{t("empty")}</div>;
  const most = shown[0].goals || 1;

  return (
    <ol className="card divide-y divide-line overflow-hidden">
      {shown.map((row, i) => {
        const player = players.get(row.playerId)!;
        const team = teams.get(row.teamId)!;
        const parts = row.parts.filter((p) => p.goals > 0);
        return (
          <li key={row.playerId} className="rise" style={{ animationDelay: `${i * 45}ms` }}>
            <Link href={`/players/${player.slug}`} className="row-hover block px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className="tnum w-5 shrink-0 text-sm text-faint">{i + 1}</span>
                <TeamCrest team={team} size={26} />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-sm font-medium">{player.name}</span>
                  <span className="truncate text-[11px] text-muted">
                    {teamShortName(team, locale)}
                    {parts.length > 1 && <> · {t("inN", { n: parts.length })}</>}
                  </span>
                </span>
                <span className="tnum shrink-0 text-end">
                  <span className="text-base font-semibold">{row.goals}</span>
                  <span className="ms-1 text-[11px] text-faint">{t("goalsShort")}</span>
                </span>
              </div>
              {/* The working, under the answer. */}
              {/* No `dir` pin: the bar grows from the side the page reads
                  from, so it starts under the name in both languages. */}
              <div className="mt-1.5 flex h-1.5 gap-0.5 ps-8">
                {parts.map((p) => {
                  const c = competitions.get(p.competitionId);
                  return (
                    <span
                      key={p.competitionId}
                      className="block rounded-full"
                      style={{
                        width: `${(p.goals / most) * 100}%`,
                        backgroundColor: c?.color ?? "var(--text-faint)",
                      }}
                      title={`${c ? competitionName(c, locale) : p.competitionId} — ${p.goals}`}
                    />
                  );
                })}
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/** Which colour is which competition. Without it the bars are decoration. */
export async function AcrossKey({ competitions }: { competitions: Competition[] }) {
  const locale = await getLocale();
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted">
      {competitions.map((c) => (
        <li key={c.id}>
          <Link
            href={`/leagues/${c.slug}/stats`}
            className="flex items-center gap-1.5 hover:text-ink"
          >
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: c.color }}
              aria-hidden="true"
            />
            {competitionName(c, locale)}
          </Link>
        </li>
      ))}
    </ul>
  );
}
