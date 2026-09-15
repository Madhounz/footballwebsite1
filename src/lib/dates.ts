/**
 * Date helpers. The site works in calendar days (YYYY-MM-DD) for the match
 * list and in UTC instants for kickoffs. Rendering uses the visitor's timezone
 * on the client; the server formats in UTC to keep markup deterministic.
 *
 * Formatting goes through Intl so Arabic and English share one code path.
 * Digits stay Western in every locale: scores and tables read faster that way.
 */

export const DAY_MS = 86_400_000;

export type ISODate = `${number}-${number}-${number}`;

export function toISODate(d: Date): ISODate {
  return d.toISOString().slice(0, 10) as ISODate;
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function isISODate(value: string | undefined | null): value is ISODate {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && toISODate(d) === value;
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function daysBetween(from: ISODate, to: ISODate): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / DAY_MS);
}

export function dateOf(iso: string): ISODate {
  return iso.slice(0, 10) as ISODate;
}

/** BCP-47 tag for Intl: Egyptian Arabic conventions with Western digits, British English otherwise. */
export function intlLocale(locale: string): string {
  return locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB";
}

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", ...opts });
    cache.set(key, f);
  }
  return f;
}

const midnight = (date: ISODate) => new Date(`${date}T00:00:00Z`);

/** "Sat 12 Sep" / "السبت 12 سبتمبر" */
export function formatShortDate(date: ISODate, locale = "en"): string {
  return fmt(locale, { weekday: "short", day: "numeric", month: "short" })
    .format(midnight(date))
    .replace("Sept", "Sep");
}

/** "Saturday, 12 September 2026" */
export function formatLongDate(date: ISODate, locale = "en"): string {
  return fmt(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    midnight(date),
  );
}

/** "12 Sep 2026" */
export function formatMediumDate(date: ISODate, locale = "en"): string {
  return fmt(locale, { day: "numeric", month: "short", year: "numeric" })
    .format(midnight(date))
    .replace("Sept", "Sep");
}

/** Which relative label a day gets on the date strip, if any. */
export function relativeDayKey(
  date: ISODate,
  today: ISODate,
): "today" | "yesterday" | "tomorrow" | null {
  const diff = daysBetween(today, date);
  if (diff === 0) return "today";
  if (diff === -1) return "yesterday";
  if (diff === 1) return "tomorrow";
  return null;
}

/** "20:00" in UTC. Client components re-render this in local time. */
export function formatKickoffUTC(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function ageFromDOB(dob: string, now: Date = new Date()): number {
  const b = new Date(dob);
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}
