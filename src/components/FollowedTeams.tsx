"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useFollowing } from "./useFollowing";

/**
 * What your clubs are doing, at the top of the day.
 *
 * The followed list lives on the device, so this cannot be rendered on the
 * server: the section simply is not there until the browser says who to ask
 * about, and it takes no space for anyone who follows nobody.
 */
interface SlimMatch {
  slug: string;
  kickoff: string;
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
  minute: number | null;
  phase: string;
  score: { home: number; away: number } | null;
  competition: { id: string; color: string };
  home: { id: string; slug: string; crestUrl: string | null };
  away: { id: string; slug: string; crestUrl: string | null };
}
interface FollowedTeam {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  colors: [string, string];
  crestUrl: string | null;
  next: SlimMatch | null;
  last: SlimMatch | null;
}

export function FollowedTeams({ names }: { names: Record<string, string> }) {
  const t = useTranslations("follow");
  const tm = useTranslations("match");
  const locale = useLocale();
  const following = useFollowing();
  // Keyed by the list it answers, so a reply for clubs you have since changed
  // is ignored rather than shown, and nothing is set outside the fetch.
  const [data, setData] = useState<{ key: string; teams: FollowedTeam[] } | null>(null);
  const key = following.join(",");

  useEffect(() => {
    if (!key) return;
    const abort = new AbortController();
    fetch(`/api/following?teams=${encodeURIComponent(key)}`, { signal: abort.signal })
      .then((r) => (r.ok ? r.json() : { teams: [] }))
      .then((d: { teams: FollowedTeam[] }) => setData({ key, teams: d.teams }))
      .catch(() => {
        // An offline device keeps the rest of the page; it just cannot say this bit.
      });
    return () => abort.abort();
  }, [key]);

  const teams = data?.key === key ? data.teams : null;
  if (!key || !teams?.length) return null;

  const label = (id: string, fallback: string) => names[id] ?? fallback;
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-faint">
        {t("yourClubs")}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {teams.map((team) => {
          const m = team.next ?? team.last;
          const live = m?.status === "live";
          const opponent = m && (m.home.id === team.id ? m.away : m.home);
          return (
            <li key={team.id} className="card overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Link href={`/teams/${team.slug}`} className="flex min-w-0 items-center gap-2">
                  {/* The provider's crest when there is one, the club's colour when there is not. */}
                  {team.crestUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={team.crestUrl}
                      alt=""
                      width={24}
                      height={24}
                      className="h-6 w-6 shrink-0 object-contain"
                    />
                  ) : (
                    <span
                      className="h-6 w-6 shrink-0 rounded-full"
                      style={{ background: team.colors[0] }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate text-sm font-medium">
                    {label(team.id, team.shortName)}
                  </span>
                </Link>
                {m && opponent ? (
                  <Link
                    href={`/match/${m.slug}`}
                    className="ms-auto flex min-w-0 items-center gap-2 text-sm hover:underline"
                  >
                    <span className="truncate text-muted">
                      {m.home.id === team.id ? tm("vs") : tm("at")}{" "}
                      {label(opponent.id, opponent.slug)}
                    </span>
                    {m.score ? (
                      <span className="tnum font-medium" dir="ltr">
                        {m.score.home}–{m.score.away}
                      </span>
                    ) : (
                      <span className="tnum text-muted">{fmtTime(m.kickoff)}</span>
                    )}
                  </Link>
                ) : (
                  <span className="ms-auto text-sm text-faint">{t("noFixture")}</span>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-line px-3 py-1.5 text-[11px] text-faint">
                <span
                  className={`flex items-center gap-1.5 ${live ? "font-medium text-live" : ""}`}
                >
                  {live && <span className="live-dot" />}
                  {m
                    ? live
                      ? tm("liveWord")
                      : m.status === "finished"
                        ? tm("ft")
                        : fmtDay(m.kickoff)
                    : ""}
                </span>
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: m?.competition.color }}
                  aria-hidden="true"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
