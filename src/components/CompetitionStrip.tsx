"use client";

import { Link, usePathname } from "@/i18n/navigation";

/**
 * The competition bar under the header.
 *
 * With five competitions this was a row of links. With eleven it is a row of
 * links that runs off the side of a phone, and the reader has no idea what is
 * out there or which of it matters today — so it stops being navigation and
 * becomes a thing to scroll past.
 *
 * Two changes fix that. Each competition says whether there is football in it
 * right now: a pulsing dot when something is in play, a count when there are
 * matches today, nothing when there are none. And on a phone the bar leads
 * with the competitions that actually have matches — the rest are one tap
 * away behind a chip that says how many, rather than four swipes away. The
 * order is never shuffled: what is dropped on a small screen is dropped, what
 * is shown keeps the site's order, so the bar is the same bar everywhere.
 *
 * The active competition wears its own colour rather than the generic grey,
 * which is the one place on the site where eleven colours in a row is the
 * point: it is an index of competitions, and the colours are how they are
 * told apart everywhere else.
 */
export interface StripItem {
  id: string;
  slug: string;
  /** Already localised: this component does no naming. */
  name: string;
  color: string;
  live: number;
  today: number;
  /** Kept on a phone. The rest hide behind the chip at the end. */
  lead: boolean;
  /** Where it sits in the phone shortlist; ignored once the whole bar fits. */
  order: number;
}

export function CompetitionStrip({ items, more }: { items: StripItem[]; more: string }) {
  const pathname = usePathname();
  const hidden = items.filter((i) => !i.lead).length;

  return (
    <div className="strip-fade scrollbar-none overflow-x-auto">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-1.5 sm:px-6">
        {items.map((c) => {
          const href = `/leagues/${c.slug}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={c.id}
              href={href}
              aria-current={active ? "page" : undefined}
              style={{ "--c": c.color, "--o": c.order } as React.CSSProperties}
              className={`comp-pill items-center gap-1.5 ${active ? "is-active" : ""} ${
                c.lead ? "inline-flex" : "hidden md:inline-flex"
              }`}
            >
              <span className="comp-dot" aria-hidden="true" />
              <span className="whitespace-nowrap">{c.name}</span>
              {c.live > 0 ? (
                <span className="flex items-center gap-1 text-live">
                  <span className="live-dot" />
                  <span className="tnum text-[11px] font-semibold">{c.live}</span>
                </span>
              ) : c.today > 0 ? (
                <span className="tnum text-[11px] text-faint">{c.today}</span>
              ) : null}
            </Link>
          );
        })}
        {hidden > 0 && (
          <Link
            href="/leagues"
            style={{ "--o": 99 } as React.CSSProperties}
            className="comp-pill comp-more inline-flex items-center whitespace-nowrap md:hidden"
            aria-label={more}
          >
            {more}
          </Link>
        )}
      </div>
    </div>
  );
}
