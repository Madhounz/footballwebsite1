import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { competitionName } from "@/lib/i18n/names";
import type { Competition, Player, ScorerRow, Team } from "@/lib/types";
import { TeamCrest } from "./TeamCrest";

/**
 * Who is scoring, across every competition at once.
 *
 * The rest of the home page is clubs — fixtures, results, tables — and the
 * other half of a season is the race for the golden boot. It is also the only
 * thing here that is never empty: a Wednesday can have two matches on it, but
 * a scoring chart has something to say every day from August to May. It costs
 * nothing to show, being the chart the refresh already stores.
 *
 * The bars are the accent rather than the competition's colour. Three of the
 * five are near-black — the Premier League's purple, the Champions League's
 * navy — and a bar nobody can see is worse than no bar. The colour stays where
 * it identifies rather than where it has to be read.
 */
export interface Race {
  competition: Competition;
  rows: ScorerRow[];
}

export async function ScoringRaces({
  races,
  players,
  teams,
}: {
  races: Race[];
  players: Map<string, Pick<Player, "id" | "slug" | "name">>;
  teams: Map<string, Team>;
}) {
  const t = await getTranslations("home");
  const locale = await getLocale();
  const shown = races.filter((r) => r.rows.length > 0);
  if (shown.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          {t("scoringRaces")}
        </h2>
        {/* Six leaders is a front page; the whole chart, added up, is a page
            of its own. */}
        <Link href="/scorers" className="text-[11px] text-muted hover:text-ink">
          {t("allScorers")}
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map(({ competition, rows }, card) => {
          // Every bar is read against the leader, so the top of each chart is
          // full and the rest are a fraction of it — the gap is the story.
          const most = rows[0].goals || 1;
          return (
            <div
              key={competition.id}
              className="rise card overflow-hidden"
              style={{ animationDelay: `${card * 70}ms` }}
            >
              <Link
                href={`/leagues/${competition.slug}/stats`}
                className="flex items-center justify-between gap-2 px-4 py-2.5 text-[13px] font-semibold transition-colors hover:bg-surface-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: competition.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{competitionName(competition, locale)}</span>
                </span>
                <span className="shrink-0 text-xs text-faint">{locale === "ar" ? "←" : "→"}</span>
              </Link>
              <ol className="border-t border-line">
                {rows.map((r, i) => {
                  const player = players.get(r.playerId);
                  const team = teams.get(r.teamId);
                  if (!player || !team) return null;
                  const delay = card * 70 + 140 + i * 90;
                  return (
                    <li key={r.playerId}>
                      <Link
                        href={`/players/${player.slug}`}
                        className="row-hover block px-4 py-2"
                        aria-label={`${player.name}, ${t("goalsN", { n: r.goals })}`}
                      >
                        <div className="flex items-center gap-2">
                          <TeamCrest team={team} size={18} />
                          <span
                            className={`min-w-0 flex-1 truncate text-sm ${
                              i === 0 ? "font-medium" : "text-muted"
                            }`}
                          >
                            {player.name}
                          </span>
                          <span
                            className={`tnum shrink-0 ${
                              i === 0 ? "text-base font-semibold" : "text-sm text-muted"
                            }`}
                            dir="ltr"
                          >
                            {r.goals}
                          </span>
                        </div>
                        <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="tape-fill h-full rounded-full"
                            style={
                              {
                                "--w": `${Math.round((r.goals / most) * 100)}%`,
                                background: "var(--accent)",
                                opacity: i === 0 ? 1 : 0.4,
                                animationDelay: `${delay}ms`,
                              } as React.CSSProperties
                            }
                          />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}
