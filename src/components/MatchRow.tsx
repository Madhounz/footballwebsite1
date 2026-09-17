import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { MatchView } from "@/lib/types";
import { livePhaseLabel } from "@/lib/format";
import { isLive, isStaleLive } from "@/lib/live-status";
import { teamName, teamShortName } from "@/lib/i18n/names";
import { LocalTime } from "./LocalTime";
import { Score } from "./Score";
import { TeamCrest } from "./TeamCrest";

/**
 * One fixture. Reads start-to-end: home · score/time · away, with status under
 * the score. Live matches get the pulsing dot; finished ones bold the winner.
 *
 * Every measurement here is a container query, never a breakpoint. The same row
 * is used across the full width of a day's list and inside a 340px sidebar, and
 * on a wide screen a breakpoint says "roomy" to both — which spent forty pixels
 * of a narrow column on padding and a score box, and left the club names to be
 * cut to "Nott'm…" and "Crysta…". The row can see how wide the row is.
 */
export async function MatchRow({
  view,
  showRound = false,
}: {
  view: MatchView;
  showRound?: boolean;
}) {
  const t = await getTranslations("match");
  const locale = await getLocale();
  const { match: m, home, away } = view;
  // Not `status === "live"`: a record can stay live after a match was abandoned
  // or postponed, and a green pulse beside one of those is a lie.
  const live = isLive(m);
  const stale = isStaleLive(m);
  const finished = m.status === "finished";
  const homeWin = finished && m.score && m.score.home > m.score.away;
  const awayWin = finished && m.score && m.score.away > m.score.home;

  const status = live
    ? m.phase === "HT"
      ? t("ht")
      : m.minute == null
        ? t("liveWord")
        : livePhaseLabel(m.phase, m.minute)
    : finished
      ? m.phase === "PEN"
        ? t("pens")
        : m.phase === "ET"
          ? t("aet")
          : t("ft")
      : stale
        ? t("noUpdate")
        : m.status === "postponed"
          ? t("postponed")
          : m.status === "cancelled"
            ? t("cancelled")
            : showRound
              ? t("md", { n: m.round })
              : "";

  return (
    <Link
      href={`/match/${m.slug}`}
      className="row-hover @container grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 @[520px]:gap-3 @[520px]:px-4"
      aria-label={`${teamName(home, locale)} ${m.score ? `${m.score.home}–${m.score.away}` : t("vs")} ${teamName(away, locale)}`}
    >
      <span
        className={`flex min-w-0 items-center justify-end gap-2 text-end text-[15px] ${homeWin ? "font-semibold" : ""} ${awayWin ? "text-muted" : ""}`}
      >
        <span className="truncate">
          <span className="hidden @[520px]:inline">{teamName(home, locale)}</span>
          <span className="@[520px]:hidden">{teamShortName(home, locale)}</span>
        </span>
        <TeamCrest team={home} size={24} />
      </span>

      <span className="flex w-[72px] shrink-0 flex-col items-center justify-center @[520px]:w-[96px]">
        {m.score ? (
          <Score
            home={m.score.home}
            away={m.score.away}
            className="text-lg font-semibold leading-none tracking-tight"
          />
        ) : m.status === "scheduled" ? (
          <LocalTime iso={m.kickoff} className="text-[15px] font-medium leading-none" />
        ) : (
          <span className="text-sm font-medium text-muted">—</span>
        )}
        <span
          className={`mt-1 flex items-center gap-1.5 text-[11px] leading-none ${live ? "font-medium text-live" : "text-faint"}`}
        >
          {live && <span className="live-dot" aria-hidden="true" />}
          {status}
          {m.disputed && (
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-review"
              title={t("disputed")}
              aria-label={t("disputedShort")}
            />
          )}
        </span>
      </span>

      <span
        className={`flex min-w-0 items-center gap-2 text-[15px] ${awayWin ? "font-semibold" : ""} ${homeWin ? "text-muted" : ""}`}
      >
        <TeamCrest team={away} size={24} />
        <span className="truncate">
          <span className="hidden @[520px]:inline">{teamName(away, locale)}</span>
          <span className="@[520px]:hidden">{teamShortName(away, locale)}</span>
        </span>
      </span>
    </Link>
  );
}
