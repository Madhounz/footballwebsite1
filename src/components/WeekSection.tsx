import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { WeekPick } from "@/lib/data/week";
import { competitionShortName, teamShortName } from "@/lib/i18n/names";
import { Empty } from "./Section";
import { TeamCrest } from "./TeamCrest";

/**
 * One of the week's findings, as a short list of matches.
 *
 * Every row shows the number that put it there, because the list is a sort and
 * not an opinion — "9 goals", "+16 places", "from two down". A reader who
 * wants to argue with the order can see what the order was.
 */
export type WeekKind = "comebacks" | "thrashings" | "thrillers" | "upsets";

export async function WeekSection({
  kind,
  picks,
  empty,
}: {
  kind: WeekKind;
  picks: WeekPick[];
  empty: string;
}) {
  const t = await getTranslations("week");
  const locale = await getLocale();
  if (picks.length === 0) return <Empty>{empty}</Empty>;

  return (
    <ul className="card divide-y divide-line overflow-hidden">
      {picks.map(({ view, value }, i) => {
        const { match, home, away, competition } = view;
        const score = match.score!;
        const homeWon = score.home > score.away;
        return (
          <li key={match.id} className="rise" style={{ animationDelay: `${i * 70}ms` }}>
            <Link href={`/match/${match.slug}`} className="row-hover block px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: competition.color }}
                  aria-hidden="true"
                />
                <span className="truncate text-[10px] uppercase tracking-wide text-faint">
                  {competitionShortName(competition, locale)}
                </span>
                <span className="ms-auto shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted">
                  {t(`${kind}Badge`, { n: value })}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2" dir="ltr">
                <span
                  className={`flex min-w-0 flex-1 items-center justify-end gap-1.5 ${homeWon ? "font-semibold" : ""}`}
                >
                  <span className="truncate text-sm">{teamShortName(home, locale)}</span>
                  <TeamCrest team={home} size={20} />
                </span>
                <span className="tnum shrink-0 rounded bg-surface-2 px-2 py-0.5 text-sm font-semibold">
                  {score.home}–{score.away}
                </span>
                <span
                  className={`flex min-w-0 flex-1 items-center gap-1.5 ${!homeWon && score.away > score.home ? "font-semibold" : ""}`}
                >
                  <TeamCrest team={away} size={20} />
                  <span className="truncate text-sm">{teamShortName(away, locale)}</span>
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
