import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  addDays,
  formatLongDate,
  formatShortDate,
  relativeDayKey,
  type ISODate,
} from "@/lib/dates";
import { DatePicker } from "./DatePicker";

/** Yesterday / Today / Tomorrow front and centre, with a real date picker beside them. */
export async function DateStrip({ date, today }: { date: ISODate; today: ISODate }) {
  const t = await getTranslations("dates");
  const locale = await getLocale();
  const label = (d: ISODate) => {
    const key = relativeDayKey(d, today);
    return key ? t(key) : formatShortDate(d, locale);
  };
  const days = [-3, -2, -1, 0, 1, 2, 3].map((d) => addDays(today, d));
  const inStrip = days.includes(date);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {formatLongDate(date, locale)}
        </h1>
        <DatePicker value={date} />
      </div>
      <div className="scrollbar-none -mx-4 flex items-center gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {!inStrip && (
          <>
            <Chip href={`/matches/${date}`} active>
              {label(date)}
            </Chip>
            <span className="mx-1 h-4 w-px shrink-0 bg-line" />
          </>
        )}
        {days.map((d) => {
          const isToday = d === today;
          return (
            <Chip
              key={d}
              href={isToday ? "/" : `/matches/${d}`}
              active={d === date}
              emphasis={isToday}
            >
              {label(d)}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}

function Chip({
  href,
  active,
  emphasis = false,
  children,
}: {
  href: string;
  active: boolean;
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "date" : undefined}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
        active
          ? "bg-ink text-on-ink"
          : emphasis
            ? "border border-line-strong font-medium text-ink hover:bg-surface-2"
            : "text-muted hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
