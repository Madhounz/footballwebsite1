"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { clubTint } from "@/lib/colors";
import { signed } from "@/lib/format";
import { pulse, shownMatch, sortClubs } from "@/lib/data/my-clubs";
import { localToday } from "@/lib/dates";
import { isLive } from "@/lib/live-status";
import type { FormResult } from "@/lib/types";
import { FormBadges } from "./Form";
import { Mark } from "./Logo";
import { TeamCrest } from "./TeamCrest";
import { toggleFollow, useFollowing } from "./useFollowing";

/**
 * Your clubs, wherever they play.
 *
 * The rest of the site is arranged by competition, which is not how anybody
 * actually follows football: you follow four clubs in three countries and
 * check on all of them at once. This is that page, and because the list lives
 * on the device it is the one page the server cannot render — it arrives
 * empty and fills itself in.
 *
 * Every card wears its club's colour, so the page belongs to whoever is
 * looking at it rather than to us. The order is the only one that makes sense
 * for a list you open to check something: in play, then today, then soon.
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

interface Club {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  code: string;
  colors: [string, string];
  crestUrl: string | null;
  next: SlimMatch | null;
  last: SlimMatch | null;
  league?: { id: string; slug: string; color: string; places: number };
  standing?: {
    position: number;
    played: number;
    points: number;
    goalDifference: number;
    movement: number;
    form: FormResult[];
    best: number;
    worst: number;
  };
}

export interface Suggestion {
  id: string;
  name: string;
  code: string;
  colors: [string, string];
  crestUrl: string | null;
  competition: string;
  color: string;
}

export function MyClubs({
  names,
  competitions,
  suggestions,
}: {
  /** Localised club names, by id: the browser knows the ids, not how to say them. */
  names: Record<string, string>;
  competitions: Record<string, string>;
  /** Somewhere to start on an empty page: whoever is top of each table today. */
  suggestions: Suggestion[];
}) {
  const t = useTranslations("follow");
  const tm = useTranslations("match");
  const locale = useLocale();
  const following = useFollowing();
  const [data, setData] = useState<{ key: string; clubs: Club[] } | null>(null);
  // Removing a club is a thing you do once in a while, so it lives behind a
  // toggle rather than putting a cross on every card for ever.
  const [editing, setEditing] = useState(false);
  const mounted = useMounted();
  const key = following.join(",");

  useEffect(() => {
    if (!key) return;
    const abort = new AbortController();
    fetch(`/api/following?detail=1&teams=${encodeURIComponent(key)}`, { signal: abort.signal })
      .then((r) => (r.ok ? r.json() : { teams: [] }))
      .then((d: { teams: Club[] }) => setData({ key, clubs: d.teams }))
      .catch(() => {
        // Offline: the page says nothing rather than saying something wrong.
      });
    return () => abort.abort();
  }, [key]);

  // Before the browser has read its own storage there is nothing to say, and a
  // flash of "follow some clubs" for somebody who follows twelve is worse than
  // a moment of quiet.
  if (!mounted) return <Skeleton />;
  if (!key) return <NoClubs names={names} suggestions={suggestions} />;
  const clubs = data?.key === key ? data.clubs : null;
  if (!clubs) return <Skeleton />;
  if (clubs.length === 0) return <NoClubs names={names} suggestions={suggestions} />;

  const today = localToday();
  const ordered = sortClubs(clubs, today);
  const p = pulse(clubs, today);
  const label = (id: string, fallback: string) => names[id] ?? fallback;

  return (
    <div className="space-y-5">
      <Pulse
        clubs={p.clubs}
        live={p.live}
        today={p.today}
        next={p.nextKickoff}
        nextClub={p.nextClubId ? label(p.nextClubId, p.nextClubId) : null}
        locale={locale}
        t={t}
        editing={editing}
        onEdit={() => setEditing((v) => !v)}
      />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ordered.map((club, i) => {
          const m = shownMatch(club);
          const live = m ? isLive(m) : false;
          const opponent = m && (m.home.id === club.id ? m.away : m.home);
          const atHome = m?.home.id === club.id;
          const tint = clubTint(club.colors);
          const st = club.standing;
          // A range that still spans the league has said nothing, so it is not
          // said. It appears by itself as the season narrows.
          const narrowed =
            st && club.league && (st.best > 1 || st.worst < club.league.places)
              ? `${st.best}–${st.worst}`
              : null;
          return (
            <li
              key={club.id}
              className={`card rise group relative overflow-hidden ${
                live ? "ring-1 ring-live/40" : ""
              }`}
              style={{
                animationDelay: `${i * 55}ms`,
                // The club's own colour, dialled down to something a page can
                // wear all day.
                ...(tint
                  ? ({
                      "--club": tint,
                      backgroundImage: `linear-gradient(160deg, color-mix(in srgb, ${tint} 11%, transparent), transparent 62%)`,
                    } as React.CSSProperties)
                  : {}),
              }}
            >
              <span
                className="absolute inset-y-0 start-0 w-[3px]"
                style={{ background: tint ?? "var(--accent)" }}
                aria-hidden="true"
              />

              <div className="flex items-center gap-2.5 px-3.5 py-3 ps-4">
                <Link href={`/teams/${club.slug}`} className="shrink-0">
                  <TeamCrest team={club} size={34} />
                </Link>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <Link
                    href={`/teams/${club.slug}`}
                    className="truncate text-[15px] font-semibold hover:underline"
                  >
                    {label(club.id, club.shortName)}
                  </Link>
                  {club.league && (
                    <Link
                      href={`/leagues/${club.league.slug}`}
                      className="flex items-center gap-1.5 truncate text-[11px] text-muted hover:text-ink"
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: club.league.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate">
                        {competitions[club.league.id] ?? club.league.slug}
                      </span>
                    </Link>
                  )}
                </span>
                {st && (
                  <span className="flex shrink-0 flex-col items-end leading-tight">
                    <span className="flex items-baseline gap-1" dir="ltr">
                      {/* The hash is not decoration: a bare number beside a
                          club reads as a score. */}
                      <span className="text-[11px] text-faint">#</span>
                      <span className="tnum text-lg font-semibold">{st.position}</span>
                      {st.movement !== 0 && (
                        <span
                          className={`text-[10px] font-semibold ${st.movement > 0 ? "text-win" : "text-loss"}`}
                          title={t(st.movement > 0 ? "climbed" : "fell", {
                            n: Math.abs(st.movement),
                          })}
                        >
                          {st.movement > 0 ? "▲" : "▼"}
                          {Math.abs(st.movement)}
                        </span>
                      )}
                    </span>
                    <span className="tnum text-[10px] text-faint">
                      {t("pts", { n: st.points })}
                    </span>
                  </span>
                )}
                {/* Unfollowing belongs where you are looking at the club. */}
                <button
                  type="button"
                  onClick={() => toggleFollow(club.id)}
                  aria-label={t("unfollow", { team: label(club.id, club.shortName) })}
                  className={`absolute end-1.5 top-1.5 h-6 w-6 items-center justify-center rounded-full bg-surface text-faint shadow-sm ring-1 ring-line transition hover:text-loss ${
                    editing ? "flex" : "hidden"
                  }`}
                >
                  <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
                    <path
                      d="M3 3l10 10M13 3L3 13"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              {m && opponent ? (
                <Link
                  href={`/match/${m.slug}`}
                  className="flex items-center gap-2.5 border-t border-line px-3.5 py-2.5 ps-4 transition-colors hover:bg-surface-2/60"
                >
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-faint">
                    {atHome ? t("h") : t("a")}
                  </span>
                  {opponent.crestUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={opponent.crestUrl}
                      alt=""
                      width={20}
                      height={20}
                      className="h-5 w-5 shrink-0 object-contain"
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {label(opponent.id, opponent.slug)}
                  </span>
                  {m.score ? (
                    <span
                      className={`tnum shrink-0 text-sm font-semibold ${live ? "text-live" : ""}`}
                      dir="ltr"
                    >
                      {live && <span className="live-dot me-1.5 align-middle" />}
                      {m.score.home}–{m.score.away}
                    </span>
                  ) : (
                    <span className="tnum shrink-0 text-sm text-muted">
                      {when(m.kickoff, locale)}
                    </span>
                  )}
                </Link>
              ) : (
                <p className="border-t border-line px-3.5 py-2.5 ps-4 text-sm text-faint">
                  {t("noFixture")}
                </p>
              )}

              <div className="flex items-center gap-2 border-t border-line px-3.5 py-2 ps-4">
                {st && st.form.length > 0 ? (
                  <FormBadges form={st.form} />
                ) : (
                  <span className="text-[11px] text-faint">{tm("noForm")}</span>
                )}
                <span className="ms-auto flex items-center gap-2.5 text-[11px] text-faint">
                  {narrowed && (
                    <span
                      className="rounded-full bg-surface-2 px-2 py-0.5 font-medium text-muted"
                      dir="ltr"
                    >
                      {t("canFinish", { range: narrowed })}
                    </span>
                  )}
                  {st && (
                    <span className="tnum" dir="ltr" title={t("gdTitle")}>
                      {signed(st.goalDifference)}
                    </span>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Whether we are past the first render. The server has no idea who anybody
 * follows, so its answer is always "no" and the browser's is always "yes" —
 * which is exactly what `useSyncExternalStore` is for, and keeps this out of
 * an effect that would render twice to say the same thing.
 */
const never = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(
    never,
    () => true,
    () => false,
  );
}

/** How the day looks across every club at once. */
function Pulse({
  clubs,
  live,
  today,
  next,
  nextClub,
  locale,
  t,
  editing,
  onEdit,
}: {
  clubs: number;
  live: number;
  today: number;
  next: string | null;
  nextClub: string | null;
  locale: string;
  t: (key: string, values?: Record<string, string | number>) => string;
  editing: boolean;
  onEdit: () => void;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
      <span className="font-medium text-ink">{t("nClubs", { n: clubs })}</span>
      {live > 0 && (
        <span className="flex items-center gap-1.5 font-medium text-live">
          <span className="live-dot" />
          {t("nLive", { n: live })}
        </span>
      )}
      {live === 0 && today > 0 && <span>{t("nToday", { n: today })}</span>}
      {live === 0 && today === 0 && next && (
        <span>
          {nextClub
            ? t("nextIsClub", { team: nextClub, when: when(next, locale) })
            : t("nextIs", { when: when(next, locale) })}
        </span>
      )}
      <button
        type="button"
        onClick={onEdit}
        className="ms-auto rounded-full px-2 py-0.5 text-[11px] font-medium text-faint transition-colors hover:bg-surface-2 hover:text-ink"
      >
        {editing ? t("done") : t("edit")}
      </button>
    </p>
  );
}

/**
 * When a match is, in the fewest words that are still true. Today gets a
 * clock, this week gets a day, anything further gets a date — the same way
 * anybody would say it out loud.
 */
function when(iso: string, locale: string): string {
  const tag = locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB";
  const d = new Date(iso);
  const time = d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (d.toDateString() === new Date().toDateString()) return time;
  if (days >= 0 && days < 7) return `${d.toLocaleDateString(tag, { weekday: "short" })} ${time}`;
  return d.toLocaleDateString(tag, { day: "numeric", month: "short" });
}

/** Quiet while the browser reads its own storage and the server answers. */
function Skeleton() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li key={i} className="card h-[124px] animate-pulse opacity-40" />
      ))}
    </ul>
  );
}

/**
 * The first thing anybody sees here, and for a while the only thing.
 *
 * An empty page that says "you have no clubs" is a dead end. This one is the
 * whole feature in one screen: what it does, a box that finds any club in the
 * site as you type, and six clubs to start from. Nothing is sold and nothing
 * is asked for — following is one tap and it never leaves the device.
 *
 * The six are whoever is top of each competition today. That is a fact rather
 * than a recommendation, it explains itself, and it changes without anybody
 * curating it.
 */
function NoClubs({
  names,
  suggestions,
}: {
  names: Record<string, string>;
  suggestions: Suggestion[];
}) {
  const t = useTranslations("follow");
  const [q, setQ] = useState("");
  const following = useFollowing();

  const needle = q.trim().toLowerCase();
  const results = needle
    ? Object.entries(names)
        .filter(([, name]) => name.toLowerCase().includes(needle))
        .sort(([, a], [, b]) => {
          const at = a.toLowerCase().startsWith(needle) ? 0 : 1;
          const bt = b.toLowerCase().startsWith(needle) ? 0 : 1;
          return at - bt || a.localeCompare(b);
        })
        .slice(0, 8)
    : [];

  return (
    <div className="space-y-8">
      <div className="card overflow-hidden px-5 py-10 text-center sm:px-8 sm:py-14">
        <Mark size={40} className="mx-auto text-faint" />
        <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("emptyTitle")}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{t("emptyLead")}</p>

        <div className="mx-auto mt-6 max-w-sm text-start">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("emptySearch", { n: Object.keys(names).length })}
            aria-label={t("emptySearch", { n: Object.keys(names).length })}
            className="w-full rounded-full border border-line bg-surface-2 px-4 py-3 text-base outline-none transition-colors placeholder:text-faint focus:border-accent"
          />
          {results.length > 0 && (
            <ul className="mt-2 overflow-hidden rounded-2xl border border-line">
              {results.map(([id, name]) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => toggleFollow(id)}
                    className="row-hover flex min-h-11 w-full items-center gap-2 px-4 text-start text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    <span className="shrink-0 text-xs font-medium text-accent">
                      {following.includes(id) ? t("followingWord") : t("followWord")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {needle && results.length === 0 && (
            <p className="mt-3 text-center text-sm text-muted">{t("emptyNoMatch", { q })}</p>
          )}
        </div>

        <p className="mt-2 text-xs text-faint">{t("emptyNoAccount")}</p>
      </div>

      {suggestions.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-faint">
            {t("emptySuggest")}
          </h3>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {suggestions.map((club) => (
              <li key={club.id}>
                <button
                  type="button"
                  onClick={() => toggleFollow(club.id)}
                  aria-pressed={following.includes(club.id)}
                  className={`card flex w-full flex-col items-center gap-2 px-2 py-4 transition-colors hover:bg-surface-2 ${
                    following.includes(club.id) ? "ring-1 ring-accent" : ""
                  }`}
                  style={{ "--c": club.color } as React.CSSProperties}
                >
                  <TeamCrest team={club} size={40} />
                  <span className="w-full truncate text-center text-[12px] font-medium">
                    {club.name}
                  </span>
                  <span className="flex w-full items-center justify-center gap-1 truncate text-[10px] text-faint">
                    <span
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: club.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{club.competition}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
