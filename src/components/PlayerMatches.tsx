import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TeamCrest } from "@/components/TeamCrest";
import { dateOf, formatShortDate } from "@/lib/dates";
import { teamShortName } from "@/lib/i18n/names";
import type { PlayerMatch } from "@/lib/data/repository";

/**
 * A player's season, match by match: where they played, what they did and how
 * long they were on. Everything here is derived from line-ups and events, so a
 * row can only say what the timeline already says.
 */
export async function PlayerMatches({
  entries,
  teamId,
}: {
  entries: PlayerMatch[];
  teamId: string;
}) {
  const t = await getTranslations("player");
  const tm = await getTranslations("match");
  const locale = await getLocale();

  return (
    <ul className="card divide-y divide-line overflow-hidden text-sm">
      {entries.map((e) => {
        const { view: v } = e;
        const isHome = v.home.id === teamId;
        const opp = isHome ? v.away : v.home;
        const gf = isHome ? v.match.score?.home : v.match.score?.away;
        const ga = isHome ? v.match.score?.away : v.match.score?.home;
        const result = gf == null || ga == null ? null : gf > ga ? "W" : gf === ga ? "D" : "L";
        const role = e.started
          ? e.offMinute != null
            ? t("offAt", { n: e.offMinute })
            : t("started")
          : t("onAt", { n: e.onMinute ?? 0 });
        return (
          <li key={v.match.id}>
            <Link
              href={`/match/${v.match.slug}`}
              className="row-hover flex items-center gap-2.5 px-3 py-2 sm:gap-3 sm:px-4"
            >
              <span className="tnum hidden w-20 shrink-0 whitespace-nowrap text-xs text-faint sm:inline">
                {formatShortDate(dateOf(v.match.kickoff), locale)}
              </span>
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: v.competition.color }}
                title={v.competition.name}
                aria-hidden="true"
              />
              <TeamCrest team={opp} size={18} />
              <span className="min-w-0 flex-1 truncate">
                <span className="text-faint">{isHome ? tm("vs") : tm("at")}</span>{" "}
                {teamShortName(opp, locale)}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {e.goals > 0 && <Mark label={tm("goal")} count={e.goals} icon="⚽" />}
                {e.ownGoals > 0 && <Mark label={tm("og")} count={e.ownGoals} icon="⚽" muted />}
                {e.assists > 0 && (
                  <Mark label={t("assists")} count={e.assists} icon={t("assistShort")} />
                )}
                {e.yellow > 0 && <Card color="bg-[#eab308]" label={tm("yellow")} n={e.yellow} />}
                {e.red && <Card color="bg-loss" label={tm("red")} n={1} />}
              </span>
              {result && (
                <span
                  className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] text-[9px] font-semibold text-white ${
                    result === "W" ? "bg-win" : result === "D" ? "bg-draw" : "bg-loss"
                  }`}
                >
                  {result}
                </span>
              )}
              <span className="tnum w-10 shrink-0 text-end font-medium" dir="ltr">
                {gf}–{ga}
              </span>
              <span
                className="tnum hidden w-12 shrink-0 text-end text-xs text-faint sm:inline"
                title={role}
              >
                {t("min", { n: e.minutes })}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Mark({
  icon,
  count,
  label,
  muted = false,
}: {
  icon: string;
  count: number;
  label: string;
  muted?: boolean;
}) {
  return (
    <span
      className={`tnum inline-flex items-center gap-0.5 text-xs ${muted ? "opacity-50" : ""}`}
      title={label}
    >
      <span aria-hidden="true">{icon}</span>
      {count > 1 && <span className="text-faint">{count}</span>}
    </span>
  );
}

function Card({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <span className="tnum inline-flex items-center gap-0.5 text-xs" title={label}>
      <span className={`inline-block h-3 w-2 rounded-[2px] ${color}`} aria-hidden="true" />
      {n > 1 && <span className="text-faint">{n}</span>}
    </span>
  );
}
