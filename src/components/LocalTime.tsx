"use client";

import { useLocale } from "next-intl";
import { useSyncExternalStore } from "react";
import { intlLocale } from "@/lib/dates";

const noop = () => () => {};

/**
 * Renders a kickoff in the visitor's timezone. The server snapshot is UTC, the
 * client snapshot is local time, so hydration is safe and there is no flash of
 * empty text.
 */
export function LocalTime({
  iso,
  withDate = false,
  className = "",
}: {
  iso: string;
  withDate?: boolean;
  className?: string;
}) {
  const locale = useLocale();
  const text = useSyncExternalStore(
    noop,
    () => local(iso, withDate, locale),
    () => utc(iso, withDate),
  );
  return (
    <time dateTime={iso} className={`tnum ${className}`} suppressHydrationWarning>
      {text}
    </time>
  );
}

function local(iso: string, withDate: boolean, locale: string): string {
  const d = new Date(iso);
  const tag = intlLocale(locale);
  const time = d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });
  if (!withDate) return time;
  const date = d.toLocaleDateString(tag, { weekday: "short", day: "numeric", month: "short" });
  return `${date} · ${time}`;
}

function utc(iso: string, withDate: boolean): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return withDate ? `${d.toISOString().slice(0, 10)} · ${hh}:${mm}` : `${hh}:${mm}`;
}
