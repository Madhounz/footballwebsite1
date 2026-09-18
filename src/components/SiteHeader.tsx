import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { matchesOnDate } from "@/lib/data";
import { competitionFocus } from "@/lib/data/focus";
import { viewerToday } from "@/lib/viewer";
import { isLive } from "@/lib/live-status";
import type { Competition, SearchItem } from "@/lib/types";
import { competitionNavName } from "@/lib/i18n/names";
import { CompetitionStrip, type StripItem } from "./CompetitionStrip";
import { Wordmark } from "./Logo";
import { Search } from "./Search";
import { ThemeToggle } from "./ThemeToggle";
import { NavLink } from "./NavLink";
import { LocaleSwitch } from "./LocaleSwitch";

/**
 * How many competitions the bar keeps on a phone. Four fits a small screen
 * with the chip beside it and still shows that the bar scrolls.
 */
const PHONE_LEAD = 4;

export async function SiteHeader({
  competitions,
  searchItems,
  demo,
}: {
  competitions: Competition[];
  searchItems: SearchItem[];
  demo: boolean;
}) {
  const t = await getTranslations("nav");
  const locale = await getLocale();
  // What is on today, in one query, so the bar can say where the football is
  // rather than just listing competitions.
  const today = await matchesOnDate(await viewerToday());
  const counts = new Map<string, { live: number; today: number }>();
  for (const v of today) {
    const c = counts.get(v.competition.id) ?? { live: 0, today: 0 };
    c.today++;
    if (isLive(v.match)) c.live++;
    counts.set(v.competition.id, c);
  }
  // A phone leads with the competitions that have matches; the rest are behind
  // the chip at the end, in the site's own order either way.
  const focus = competitionFocus(competitions, today, PHONE_LEAD);
  const leading = new Set(focus.shown.map((c) => c.id));
  // On a phone the shortlist is also *ordered* by where the football is —
  // something in play first, then matches today, then the site's order. A
  // four-item list that changes membership daily has no muscle memory to
  // protect, and the one with a live match should not be the one off-screen.
  // The full bar on a larger screen keeps the site's order, untouched.
  const phoneOrder = new Map(
    focus.shown
      .map((c) => ({ c, ...(counts.get(c.id) ?? { live: 0, today: 0 }) }))
      .sort(
        (a, b) =>
          Number(b.live > 0) - Number(a.live > 0) ||
          Number(b.today > 0) - Number(a.today > 0) ||
          a.c.order - b.c.order,
      )
      .map(({ c }, i) => [c.id, i]),
  );
  const strip: StripItem[] = competitions.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: competitionNavName(c, locale),
    color: c.color,
    live: counts.get(c.id)?.live ?? 0,
    today: counts.get(c.id)?.today ?? 0,
    lead: leading.has(c.id),
    order: phoneOrder.get(c.id) ?? PHONE_LEAD,
  }));
  const hidden = strip.filter((c) => !c.lead).length;
  const nav = [
    { href: "/", label: t("matches"), exact: true },
    { href: "/leagues", label: t("leagues") },
    { href: "/week", label: t("week") },
    { href: "/scorers", label: t("scorers") },
    { href: "/following", label: t("following") },
    { href: "/teams", label: t("teams") },
    { href: "/about", label: t("about") },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4 sm:h-14 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex min-h-10 items-center" aria-label={t("home")}>
            <Wordmark locale={locale} />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label={t("primary")}>
            {nav.map((n) => (
              <NavLink key={n.href} href={n.href} exact={n.exact}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {demo && (
            <Link
              href="/about#data"
              className="hidden rounded-full border border-dashed border-line-strong px-2.5 py-1 text-[11px] font-medium text-muted hover:text-ink sm:inline"
              title={t("demoTitle")}
            >
              {t("demoBadge")}
            </Link>
          )}
          <Search items={searchItems} />
          <LocaleSwitch />
          <ThemeToggle />
        </div>
      </div>
      <div className="border-t border-line/60">
        <CompetitionStrip items={strip} more={t("moreLeagues", { n: hidden })} />
      </div>
    </header>
  );
}
