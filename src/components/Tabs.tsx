"use client";

import { Link, usePathname } from "@/i18n/navigation";

export interface Tab {
  href: string;
  label: string;
  exact?: boolean;
}

export function Tabs({ tabs, ariaLabel }: { tabs: Tab[]; ariaLabel: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={ariaLabel}
      className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex gap-1 border-b border-line">
        {tabs.map((t) => {
          const active = t.exact
            ? pathname === t.href
            : pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors sm:min-h-0 sm:py-2.5 ${
                  active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
