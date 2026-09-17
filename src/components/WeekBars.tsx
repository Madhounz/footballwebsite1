import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { WeekDay } from "@/lib/data/week";
import type { ISODate } from "@/lib/dates";

/**
 * Seven days of goals, as seven bars.
 *
 * The shape of a football week is not flat and everybody knows it — two tall
 * bars at the weekend, a midweek bump when Europe plays, and the quiet days
 * in between. Drawing it takes one number per day that we already counted, and
 * it turns a page of numbers into a week you can see at a glance.
 */
export async function WeekBars({ days, today }: { days: WeekDay[]; today: ISODate }) {
  const t = await getTranslations("week");
  const locale = await getLocale();
  const most = Math.max(1, ...days.map((d) => d.goals));
  const tag = locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB";

  return (
    <div className="card px-4 py-4">
      <ol className="flex items-end gap-1.5 sm:gap-3" dir="ltr">
        {days.map((day, i) => {
          const share = day.goals / most;
          const isToday = day.date === today;
          const weekday = new Date(`${day.date}T12:00:00Z`).toLocaleDateString(tag, {
            weekday: "long",
          });
          const label = `${weekday} — ${t("dayTitle", { matches: day.matches, goals: day.goals })}`;
          return (
            <li key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className="tnum text-[11px] font-semibold text-muted">
                {day.goals > 0 ? day.goals : ""}
              </span>
              <Link
                href={`/matches/${day.date}`}
                title={label}
                aria-label={label}
                className="flex w-full items-end justify-center rounded-t-[3px] bg-surface-2/50"
                style={{ height: 96 }}
              >
                {/* Grown from nothing on arrival, one after another — the week
                    filling itself in. A day with no football keeps a sliver so
                    the row still reads as seven days. */}
                <span
                  className={`week-bar w-full rounded-t-[3px] ${isToday ? "bg-accent" : "bg-accent/45"}`}
                  style={
                    {
                      "--h": `${Math.max(2, Math.round(share * 96))}px`,
                      animationDelay: `${i * 70}ms`,
                    } as React.CSSProperties
                  }
                />
              </Link>
              <span
                className={`truncate text-[10px] ${isToday ? "font-semibold text-ink" : "text-faint"}`}
              >
                {new Date(`${day.date}T12:00:00Z`).toLocaleDateString(tag, { weekday: "short" })}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
