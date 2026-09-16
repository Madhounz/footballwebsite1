import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { FormEntry } from "@/lib/data/match-context";
import { teamShortName } from "@/lib/i18n/names";
import type { Competition, FormResult, Team } from "@/lib/types";
import { TeamCrest } from "./TeamCrest";

/**
 * Who is arriving on a run, anywhere.
 *
 * The scoring races beside it are players and totals; this is clubs and
 * momentum, which is the other way a season is followed. A table says who is
 * top, and says nothing about who is climbing.
 *
 * It costs no query: the standings the page already loads carry each club's
 * last five, which is all a run is.
 */
const PILL: Record<FormResult, string> = {
  W: "bg-[var(--win)]",
  D: "bg-[var(--draw)]",
  L: "bg-[var(--loss)]",
};

export async function InForm({
  entries,
  teams,
  competitions,
}: {
  entries: FormEntry[];
  teams: Map<string, Team>;
  competitions: Map<string, Competition>;
}) {
  const t = await getTranslations("home");
  const tm = await getTranslations("match");
  const locale = await getLocale();
  if (entries.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-faint">
        {t("inForm")}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((e, i) => {
          const team = teams.get(e.teamId);
          const competition = competitions.get(e.competitionId);
          if (!team) return null;
          const label =
            e.streak.kind === "W"
              ? tm("streakWins", { n: e.streak.count })
              : tm("streakUnbeaten", { n: e.streak.count });
          return (
            <li key={`${e.competitionId}:${e.teamId}`}>
              <Link
                href={`/teams/${team.slug}`}
                className="rise card row-hover flex items-center gap-3 px-3 py-2.5"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {competition && (
                  <span
                    className="h-8 w-[3px] shrink-0 rounded-full"
                    style={{ backgroundColor: competition.color }}
                    aria-hidden="true"
                  />
                )}
                <TeamCrest team={team} size={26} />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-sm font-medium">
                    {teamShortName(team, locale)}
                  </span>
                  <span className="truncate text-[11px] text-muted">{label}</span>
                </span>
                {/* Pinned left-to-right so the five read oldest to newest in
                    either language, the way a form guide always has. */}
                <span className="flex shrink-0 gap-[3px]" dir="ltr" aria-hidden="true">
                  {[...e.form].reverse().map((r, j) => (
                    <span
                      key={j}
                      className={`rise h-1.5 w-1.5 rounded-full ${PILL[r]}`}
                      style={{ animationDelay: `${i * 60 + 160 + j * 45}ms` }}
                    />
                  ))}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
