import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { RunInRow } from "@/lib/data/run-in";
import { teamShortName } from "@/lib/i18n/names";
import type { Competition, TableZone, Team } from "@/lib/types";
import { TeamCrest } from "./TeamCrest";

/**
 * Every club's remaining season as a band across the table.
 *
 * The track is the league, first place to last. The bar on it is every place
 * the club can still finish, and it can only ever shrink: in August it spans
 * the whole track and says nothing, by April it is a few places wide and says
 * everything. Watching the bars pull apart is the season.
 *
 * The zones sit behind it in their own colours, so "can we still reach the
 * Champions League places" is answered by whether the bar still touches the
 * green, without a word of explanation.
 */
const TONE: Record<TableZone["tone"], string> = {
  top: "bg-accent",
  second: "bg-sky-500",
  third: "bg-amber-500",
  bottom: "bg-loss",
};

/** 0.25 for a range that spans the league, 1 for a place already settled. */
function certainty(best: number, worst: number, total: number): number {
  if (total <= 1) return 1;
  const span = (worst - best) / (total - 1);
  return Number((0.25 + 0.75 * (1 - span)).toFixed(3));
}

export async function RunInTable({
  rows,
  teams,
  competition,
}: {
  rows: RunInRow[];
  teams: Map<string, Team>;
  competition: Competition;
}) {
  const t = await getTranslations("league");
  const locale = await getLocale();
  const total = rows.length;
  if (total === 0) return null;
  const pct = (place: number) => ((place - 1) / total) * 100;

  return (
    <div className="card overflow-hidden">
      <table className="tnum w-full text-sm">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wide text-faint">
            <th className="w-9 py-2.5 pe-1 ps-4 text-start font-medium">{t("th.pos")}</th>
            <th className="py-2.5 text-start font-medium">{t("th.club")}</th>
            <th className="hidden w-11 py-2.5 text-center font-medium sm:table-cell">
              {t("th.p")}
            </th>
            <th className="w-11 py-2.5 text-center font-medium">{t("th.left")}</th>
            <th className="w-11 py-2.5 text-center font-semibold text-ink">{t("th.pts")}</th>
            <th className="hidden w-11 py-2.5 text-center font-medium sm:table-cell">
              {t("th.max")}
            </th>
            <th className="hidden w-12 py-2.5 text-center font-medium md:table-cell">
              {t("th.pace")}
            </th>
            <th className="w-[38%] py-2.5 pe-4 text-start font-medium">{t("th.canFinish")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const team = teams.get(r.teamId);
            if (!team) return null;
            const pinned = r.best === r.worst;
            return (
              <tr key={r.teamId} className="row-hover border-b border-line last:border-0">
                <td className="py-2 pe-1 ps-4 text-muted">{r.position}</td>
                <td className="py-2">
                  <Link
                    href={`/teams/${team.slug}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <TeamCrest team={team} size={20} />
                    <span className="truncate">{teamShortName(team, locale)}</span>
                  </Link>
                </td>
                <td className="hidden py-2 text-center text-muted sm:table-cell">{r.played}</td>
                <td className="py-2 text-center text-muted">{r.remaining}</td>
                <td className="py-2 text-center font-semibold">{r.points}</td>
                <td className="hidden py-2 text-center text-muted sm:table-cell">{r.maxPoints}</td>
                <td className="hidden py-2 text-center text-faint md:table-cell">
                  {r.pace ?? "—"}
                </td>
                <td className="py-2 pe-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2"
                      title={t("canFinishTitle", { best: r.best, worst: r.worst })}
                    >
                      {competition.zones.map((z) => (
                        <span
                          key={`${z.from}-${z.to}`}
                          className={`absolute inset-y-0 opacity-20 ${TONE[z.tone]}`}
                          style={{
                            insetInlineStart: `${pct(z.from)}%`,
                            width: `${((z.to - z.from + 1) / total) * 100}%`,
                          }}
                          aria-hidden="true"
                        />
                      ))}
                      {/* The bar earns its ink. A range covering the whole
                          table has told the reader nothing, so it is barely
                          there; as it narrows it darkens, and a club whose
                          place is settled is solid. The column is quiet in
                          August and loud in May, which is the truth of it. */}
                      <span
                        className={`absolute inset-y-0 rounded-full ${pinned ? "bg-ink" : "bg-accent"}`}
                        style={{
                          insetInlineStart: `${pct(r.best)}%`,
                          width: `${((r.worst - r.best + 1) / total) * 100}%`,
                          opacity: certainty(r.best, r.worst, total),
                        }}
                      />
                    </span>
                    <span className="shrink-0 text-[11px] text-muted" dir="ltr">
                      {r.best === r.worst ? r.best : `${r.best}–${r.worst}`}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The clubs with the hardest or the kindest set of matches left. */
export async function RunList({
  rows,
  teams,
  empty,
}: {
  rows: RunInRow[];
  teams: Map<string, Team>;
  empty: string;
}) {
  const t = await getTranslations("league");
  const locale = await getLocale();
  if (rows.length === 0)
    return <div className="card px-6 py-10 text-center text-sm text-muted">{empty}</div>;
  return (
    <ul className="card divide-y divide-line overflow-hidden">
      {rows.map((r, i) => {
        const team = teams.get(r.teamId);
        if (!team) return null;
        return (
          <li key={r.teamId} className="rise" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center gap-3 px-4 py-2.5">
              <TeamCrest team={team} size={24} />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <Link
                  href={`/teams/${team.slug}`}
                  className="truncate text-sm font-medium hover:underline"
                >
                  {teamShortName(team, locale)}
                </Link>
                <span className="truncate text-[11px] text-muted">
                  {t("avgOpponent", { n: (r.difficulty ?? 0).toFixed(1) })}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {r.fixtures.slice(0, 3).map((f) => {
                  const other = teams.get(f.opponentId);
                  if (!other) return null;
                  return (
                    <Link
                      key={f.matchId}
                      href={`/match/${f.slug}`}
                      className="relative transition-opacity hover:opacity-70"
                      title={`${teamShortName(other, locale)} · ${t(f.home ? "atHome" : "away")}`}
                    >
                      <TeamCrest team={other} size={22} />
                      <span
                        className={`absolute -bottom-0.5 -end-0.5 block h-1.5 w-1.5 rounded-full ring-1 ring-surface ${
                          f.home ? "bg-accent" : "bg-faint"
                        }`}
                        aria-hidden="true"
                      />
                    </Link>
                  );
                })}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
