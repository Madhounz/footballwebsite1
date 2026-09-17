"use client";

import type { ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * Where a phone's navigation belongs: under the thumb.
 *
 * The site's nav used to be a second scrolling row inside a sticky header —
 * seven 27px links, half of them off-screen, at the far end of the reach of
 * the hand holding the phone. On an 844px screen the header was 130px before
 * a single score appeared.
 *
 * Moving it down fixes both at once. The header keeps the wordmark, search and
 * the competition bar; everything else lives here, at the bottom, in targets
 * big enough to hit without looking. Five is the most that fits without them
 * getting narrow, so the two indexes a phone reaches through search anyway —
 * clubs, and the about page — stay in the footer.
 *
 * None of this exists above 768px, where a row of links across the top is
 * both reachable and out of the way.
 */
interface Item {
  href: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Today's matches: a day on a calendar. */
const Matches = (
  <svg viewBox="0 0 24 24" {...stroke}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);
/** The week: seven days of goals. */
const Week = (
  <svg viewBox="0 0 24 24" {...stroke}>
    <path d="M4 20V13M9 20V8M14 20V15M19 20V5" />
  </svg>
);
/** Scorers: the target. */
const Scorers = (
  <svg viewBox="0 0 24 24" {...stroke}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
/** Your clubs: the one you keep. */
const Clubs = (
  <svg viewBox="0 0 24 24" {...stroke}>
    <path d="M12 4l2.3 4.9 5.2.7-3.8 3.7.95 5.3L12 16.1l-4.65 2.5.95-5.3L4.5 9.6l5.2-.7z" />
  </svg>
);
/** Leagues: a table. */
const Leagues = (
  <svg viewBox="0 0 24 24" {...stroke}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M3 9.5h18M3 15h18M9 9.5V20" />
  </svg>
);

export function BottomNav({ labels }: { labels: Record<string, string> }) {
  const pathname = usePathname();
  const items: Item[] = [
    { href: "/", label: labels.matches, icon: Matches, exact: true },
    { href: "/week", label: labels.week, icon: Week },
    { href: "/scorers", label: labels.scorers, icon: Scorers },
    { href: "/following", label: labels.following, icon: Clubs },
    { href: "/leagues", label: labels.leagues, icon: Leagues },
  ];

  return (
    <nav
      aria-label={labels.primary}
      className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-xl">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href || pathname.startsWith("/matches")
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-1 transition-colors ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <span className="h-[22px] w-[22px]" aria-hidden="true">
                  {item.icon}
                </span>
                <span className={`text-[10px] leading-none ${active ? "font-semibold" : ""}`}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
