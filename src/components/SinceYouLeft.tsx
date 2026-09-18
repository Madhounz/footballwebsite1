"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { TeamCrest } from "./TeamCrest";
import { useFollowing } from "./useFollowing";

/**
 * What happened while you were not looking.
 *
 * Every other page on the site answers "what is happening". This answers the
 * only question somebody opening it after a day away actually has: what did I
 * miss. It is the delta, not a feed — no headlines, no articles, nothing
 * anybody wrote. Matches ended, goals went in, the table moved, and your clubs
 * either played or did not.
 *
 * When you were last here is kept on the device and nowhere else, which is
 * also why this cannot be rendered on the server: the page arrives without it
 * and fills this in if there is anything to say. Below a few hours, or with
 * nothing finished, there is nothing to say and the card never appears — a
 * "while you were away: 0 matches" is worse than silence.
 */
const SEEN_KEY = "ninety:seen";
/** Under this, you have not been away. */
const AWAY_MINUTES = 90;

interface Slim {
  slug: string;
  kickoff: string;
  score: { home: number; away: number } | null;
  competition: { id: string; color: string };
  home: { id: string; slug: string };
  away: { id: string; slug: string };
}
interface Crest {
  code: string;
  colors: [string, string];
  crestUrl: string | null;
}
interface Report {
  teams: Record<string, Crest>;
  finished: number;
  goals: number;
  live: number;
  yours: { teamId: string; match: Slim; move: { from: number; to: number } | null }[];
  movers: { teamId: string; competitionId: string; from: number; to: number }[];
  next: Slim | null;
}

function lastSeen(): Date | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const at = raw ? new Date(raw) : null;
    return at && !Number.isNaN(at.getTime()) ? at : null;
  } catch {
    return null;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, new Date().toISOString());
  } catch {
    // A browser refusing storage simply never gets this card.
  }
}

export function SinceYouLeft({ names }: { names: Record<string, string> }) {
  const t = useTranslations("since");
  const locale = useLocale();
  const following = useFollowing();
  // One piece of state, set once, when the answer comes back. How long you
  // were gone is measured at the moment the question is asked rather than
  // while rendering, so the render stays a pure function of what it was given.
  const [state, setState] = useState<{ hours: number; report: Report } | null>(null);
  const key = following.join(",");

  // Captured on the first render and never again. The followed list arrives
  // empty and fills in a tick later, which re-runs this effect — and reading
  // the stamp again then would read the one this effect had just written,
  // leaving anybody who follows a club permanently up to date. Found by
  // driving a browser; nothing about it is visible in the code.
  const seenAt = useRef<Date | null | undefined>(undefined);

  useEffect(() => {
    if (seenAt.current === undefined) {
      seenAt.current = lastSeen();
      // Whatever happens next, this visit counts as having seen it — including
      // the visit where the card is shown, so it does not follow you around.
      markSeen();
    }
    const at = seenAt.current;
    if (!at || Date.now() - at.getTime() < AWAY_MINUTES * 60_000) return;
    const hours = Math.max(1, Math.round((Date.now() - at.getTime()) / 3_600_000));
    const abort = new AbortController();
    fetch(
      `/api/since?at=${encodeURIComponent(at.toISOString())}&teams=${encodeURIComponent(key)}`,
      {
        signal: abort.signal,
      },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Report | null) => d && setState({ hours, report: d }))
      .catch(() => {
        // Offline: the rest of the page is still the rest of the page.
      });
    return () => abort.abort();
  }, [key]);

  if (!state || state.report.finished === 0) return null;
  const { hours, report } = state;

  const name = (id: string) => names[id] ?? id;
  const crest = (id: string) =>
    report.teams[id] ? <TeamCrest team={report.teams[id]} size={20} /> : null;
  const clock = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <section className="since card relative overflow-hidden">
      <div className="relative flex flex-col gap-4 px-4 py-4 sm:px-5">
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-base font-semibold tracking-tight">{t("title")}</h2>
          <span className="text-[11px] text-faint">
            {hours < 48 ? t("hours", { n: hours }) : t("days", { n: Math.round(hours / 24) })}
          </span>
        </header>

        {/* The two numbers that say how much you missed, before any detail. */}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <Figure value={report.finished} label={t("matches", { n: report.finished })} />
          <Figure value={report.goals} label={t("goals", { n: report.goals })} />
          {report.live > 0 && (
            <span className="flex items-center gap-1.5 pb-1 text-sm font-medium text-live">
              <span className="live-dot" />
              {t("live", { n: report.live })}
            </span>
          )}
        </div>

        <ul className="flex flex-col gap-1.5 text-sm">
          {report.yours.map(({ teamId, match, move }) => {
            const score = match.score;
            const home = match.home.id === teamId;
            const other = home ? match.away.id : match.home.id;
            const got = score ? (home ? score.home : score.away) : 0;
            const conceded = score ? (home ? score.away : score.home) : 0;
            return (
              <li key={match.slug}>
                <Link href={`/match/${match.slug}`} className="since-row group">
                  {crest(teamId) ?? (
                    <span
                      className="since-dot"
                      style={{ backgroundColor: match.competition.color }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {t(got > conceded ? "youWon" : got < conceded ? "youLost" : "youDrew", {
                      team: name(teamId),
                      other: name(other),
                      score: `${got}–${conceded}`,
                    })}
                  </span>
                  {move && <Arrow from={move.from} to={move.to} />}
                </Link>
              </li>
            );
          })}

          {report.movers
            .filter((m) => !report.yours.some((y) => y.teamId === m.teamId))
            .map((m) => (
              <li key={`${m.competitionId}-${m.teamId}`}>
                <span className="since-row">
                  {crest(m.teamId) ?? <span className="since-dot bg-faint" aria-hidden="true" />}
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {t(m.to < m.from ? "movedUp" : "movedDown", {
                      team: name(m.teamId),
                      to: m.to,
                    })}
                  </span>
                  <Arrow from={m.from} to={m.to} />
                </span>
              </li>
            ))}

          {report.next && (
            <li>
              <Link href={`/match/${report.next.slug}`} className="since-row">
                <span
                  className="since-dot"
                  style={{ backgroundColor: report.next.competition.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-muted">
                  {t("next", {
                    home: name(report.next.home.id),
                    away: name(report.next.away.id),
                    time: clock(report.next.kickoff),
                  })}
                </span>
              </Link>
            </li>
          )}
        </ul>

        <Link
          href="/week"
          className="inline-flex min-h-10 w-full items-center justify-center rounded-full bg-accent px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:w-auto sm:self-start"
        >
          {t("catchUp")}
        </Link>
      </div>
    </section>
  );
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="tnum text-2xl font-semibold tracking-tight sm:text-3xl">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </span>
  );
}

/** Up in green, down in red, the same two colours the rest of the site uses. */
function Arrow({ from, to }: { from: number; to: number }) {
  const up = to < from;
  return (
    <span
      className={`tnum flex shrink-0 items-center gap-0.5 text-xs font-semibold ${up ? "text-win" : "text-loss"}`}
      dir="ltr"
    >
      <span aria-hidden="true">{up ? "▲" : "▼"}</span>
      {Math.abs(from - to)}
    </span>
  );
}
