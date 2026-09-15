"use client";

import { Link, usePathname } from "@/i18n/navigation";
import type { ReactNode } from "react";

export function NavLink({
  href,
  exact = false,
  small = false,
  children,
}: {
  href: string;
  exact?: boolean;
  small?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href || (href === "/" && pathname.startsWith("/matches"))
    : pathname === href || pathname.startsWith(`${href}/`);
  const base = small
    ? "whitespace-nowrap rounded-full px-2.5 py-1 text-[12.5px] font-medium"
    : "rounded-full px-3 py-1.5 text-sm font-medium";
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${base} transition-colors ${active ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}
    >
      {children}
    </Link>
  );
}
