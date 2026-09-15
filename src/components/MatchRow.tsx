import Link from "next/link";
import type { MatchView } from "@/lib/types";
import { livePhaseLabel } from "@/lib/format";
import { LocalTime } from "./LocalTime";
import { TeamCrest } from "./TeamCrest";

/**
 * One fixture. Reads left-to-right: home · score/time · away, with status on the
 * end. Live matches get the pulsing dot; finished ones bold the winner.
 */
export function MatchRow({ view, showRound = false }: { view: MatchView; showRound?: boolean }) {
  const { match: m, home, away } = view;
  const live = m.status === "live";
  const finished = m.status === "finished";
  const homeWin = finished && m.score && m.score.home > m.score.away;
  const awayWin = finished && m.score && m.score.away > m.score.home;

  return (
    <Link
      href={`/match/${m.id}`}
      className="row-hover @container grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4"
      aria-label={`${home.name} ${m.score ? `${m.score.home}–${m.score.away}` : "v"} ${away.name}`}
    >
      <span
        className={`flex min-w-0 items-center justify-end gap-2 text-right text-[15px] ${homeWin ? "font-semibold" : ""} ${awayWin ? "text-muted" : ""}`}
      >
        <span className="truncate">
          <span className="hidden @[520px]:inline">{home.name}</span>
          <span className="@[520px]:hidden">{home.shortName}</span>
        </span>
        <TeamCrest team={home} size={24} />
      </span>

      <span className="flex w-[72px] shrink-0 flex-col items-center justify-center sm:w-[96px]">
        {m.score ? (
          <span
            className={`tnum text-lg font-semibold leading-none tracking-tight ${live ? "text-ink" : ""}`}
          >
            {m.score.home}
            <span className="mx-1 text-faint">–</span>
            {m.score.away}
          </span>
        ) : m.status === "scheduled" ? (
          <LocalTime iso={m.kickoff} className="text-[15px] font-medium leading-none" />
        ) : (
          <span className="text-sm font-medium text-muted">—</span>
        )}
        <span
          className={`mt-1 flex items-center gap-1.5 text-[11px] leading-none ${live ? "font-medium text-live" : "text-faint"}`}
        >
          {live && <span className="live-dot" aria-hidden="true" />}
          {live
            ? livePhaseLabel(m.phase, m.minute)
            : finished
              ? m.phase === "PEN"
                ? "Pens"
                : m.phase === "ET"
                  ? "AET"
                  : "FT"
              : m.status === "postponed"
                ? "Postponed"
                : m.status === "cancelled"
                  ? "Cancelled"
                  : showRound
                    ? `MD ${m.round}`
                    : ""}
        </span>
      </span>

      <span
        className={`flex min-w-0 items-center gap-2 text-[15px] ${awayWin ? "font-semibold" : ""} ${homeWin ? "text-muted" : ""}`}
      >
        <TeamCrest team={away} size={24} />
        <span className="truncate">
          <span className="hidden @[520px]:inline">{away.name}</span>
          <span className="@[520px]:hidden">{away.shortName}</span>
        </span>
      </span>
    </Link>
  );
}
