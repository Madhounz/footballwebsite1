import { useLocale } from "next-intl";

/**
 * A scoreline whose home figure always sits on the home team's side: left in
 * English, right in Arabic. Each figure is bidi-isolated so the digits never
 * reorder against the text direction.
 */
export function Score({
  home,
  away,
  className = "",
}: {
  home: number;
  away: number;
  className?: string;
}) {
  const locale = useLocale();
  return (
    <span className={`tnum ${className}`} dir={locale === "ar" ? "rtl" : "ltr"}>
      <bdi>{home}</bdi>
      <span className="mx-1 text-faint">–</span>
      <bdi>{away}</bdi>
    </span>
  );
}
