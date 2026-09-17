import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Competition, SearchItem } from "@/lib/types";
import { competitionNavName } from "@/lib/i18n/names";
import { Wordmark } from "./Logo";
import { Search } from "./Search";
import { ThemeToggle } from "./ThemeToggle";
import { NavLink } from "./NavLink";
import { LocaleSwitch } from "./LocaleSwitch";

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
  const nav = [
    { href: "/", label: t("matches"), exact: true },
    { href: "/leagues", label: t("leagues") },
    { href: "/scorers", label: t("scorers") },
    { href: "/teams", label: t("teams") },
    { href: "/about", label: t("about") },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center" aria-label={t("home")}>
            <Wordmark />
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
        <div className="scrollbar-none mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-1.5 sm:px-6">
          <div className="flex items-center gap-1 md:hidden">
            {nav.map((n) => (
              <NavLink key={n.href} href={n.href} exact={n.exact} small>
                {n.label}
              </NavLink>
            ))}
            <span className="mx-1 h-4 w-px bg-line" />
          </div>
          {competitions.map((c) => (
            <NavLink key={c.id} href={`/leagues/${c.slug}`} small>
              <span
                className="me-1.5 inline-block h-2 w-2 rounded-full align-middle"
                style={{ backgroundColor: c.color }}
                aria-hidden="true"
              />
              {competitionNavName(c, locale)}
            </NavLink>
          ))}
        </div>
      </div>
    </header>
  );
}
