import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { MatchEvent, Player, Team } from "@/lib/types";
import { teamShortName } from "@/lib/i18n/names";
import { getLocale } from "next-intl/server";
import { Score } from "./Score";

const ICON: Record<MatchEvent["type"], string> = {
  goal: "⚽",
  penalty: "⚽",
  own_goal: "⚽",
  missed_penalty: "✕",
  yellow: "🟨",
  second_yellow: "🟨🟥",
  red: "🟥",
  substitution: "⇄",
  var: "VAR",
};

/** Two-sided timeline: home events on the start side of the spine, away on the end side. */
export async function EventTimeline({
  events,
  home,
  away,
  players,
  halfTime,
  fullTime = null,
  finished = false,
  complete,
}: {
  events: MatchEvent[];
  home: Team;
  away: Team;
  players: Record<string, Player>;
  halfTime: { home: number; away: number } | null;
  /** The final score, which we hold for every match even when the events are missing. */
  fullTime?: { home: number; away: number } | null;
  finished?: boolean;
  /** False while a finished match still has only what the live feed saw. */
  complete?: boolean;
}) {
  const t = await getTranslations("match");
  const locale = await getLocale();
  // A timeline that stops mid-match says so rather than passing for the whole story.
  const pending = finished && complete === false;
  if (events.length === 0) {
    // A finished match still has its scoreline, and we hold that for every
    // match. Two marks on the spine are a small timeline, and they are true —
    // which an empty card claiming nothing was recorded is not, above a 3–2.
    if (finished && (halfTime || fullTime)) {
      return (
        <div className="card px-6 py-6">
          <ol className="relative space-y-2">
            <span
              className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line"
              aria-hidden="true"
            />
            {[
              halfTime && ([t("ht"), halfTime] as const),
              fullTime && ([t("ft"), fullTime] as const),
            ]
              .filter((x) => x !== null && x !== undefined)
              .map(([label, score]) => (
                <li key={label} className="relative flex justify-center">
                  <span className="rounded-full border border-line bg-surface px-3 py-0.5 text-[11px] font-medium text-muted">
                    {label}{" "}
                    <Score home={score.home} away={score.away} className="[&>span]:mx-0.5" />
                  </span>
                </li>
              ))}
          </ol>
          <p className="mt-4 border-t border-line pt-3 text-center text-[11px] text-faint">
            {pending ? t("timelinePending") : t("eventsUnavailable")}
          </p>
        </div>
      );
    }
    return (
      <div className="card px-6 py-10 text-center text-sm text-muted">
        {!finished ? t("noEvents") : pending ? t("timelinePending") : t("eventsUnavailable")}
      </div>
    );
  }
  const first = events.filter((e) => e.minute <= 45);
  const second = events.filter((e) => e.minute > 45);
  const labels = {
    on: t("subOn"),
    off: t("subOff"),
    assist: (n: string) => t("assist", { name: n }),
    yellow: t("yellow"),
    red: t("red"),
    secondYellow: t("secondYellow"),
    pen: t("pen"),
    og: t("og"),
  };
  return (
    <div className="card px-3 py-4 sm:px-6">
      <ol className="relative space-y-1">
        <span
          className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line"
          aria-hidden="true"
        />
        {first.map((e) => (
          <Item key={e.id} e={e} isHome={e.teamId === home.id} players={players} labels={labels} />
        ))}
        {halfTime && (
          <li className="relative flex justify-center py-2">
            <span className="rounded-full border border-line bg-surface px-3 py-0.5 text-[11px] font-medium text-muted">
              {t("ht")}{" "}
              <Score home={halfTime.home} away={halfTime.away} className="[&>span]:mx-0.5" />
            </span>
          </li>
        )}
        {second.map((e) => (
          <Item key={e.id} e={e} isHome={e.teamId === home.id} players={players} labels={labels} />
        ))}
      </ol>
      <div className="mt-3 flex justify-between text-[11px] text-faint">
        <span>{teamShortName(home, locale)}</span>
        <span>{teamShortName(away, locale)}</span>
      </div>
      {pending && (
        <p className="mt-3 border-t border-line pt-3 text-center text-[11px] text-faint">
          {t("timelinePending")}
        </p>
      )}
    </div>
  );
}

interface Labels {
  on: string;
  off: string;
  assist: (n: string) => string;
  yellow: string;
  red: string;
  secondYellow: string;
  pen: string;
  og: string;
}

function Item({
  e,
  isHome,
  players,
  labels,
}: {
  e: MatchEvent;
  isHome: boolean;
  players: Record<string, Player>;
  labels: Labels;
}) {
  const p = e.playerId ? players[e.playerId] : null;
  const rel = e.relatedPlayerId ? players[e.relatedPlayerId] : null;
  const isGoal = e.type === "goal" || e.type === "penalty" || e.type === "own_goal";
  const minute = `${e.minute}${e.addedTime ? `+${e.addedTime}` : ""}'`;
  const body = (
    <span
      className={`inline-flex max-w-full flex-col ${isHome ? "items-end text-end" : "items-start text-start"}`}
    >
      <span className={`truncate text-sm ${isGoal ? "font-semibold" : ""}`}>
        {e.type === "substitution" ? (
          <>
            <span className="text-win" title={labels.on} aria-label={labels.on}>
              ▲
            </span>{" "}
            {rel ? <PlayerLink p={rel} /> : "—"}
          </>
        ) : p ? (
          <PlayerLink p={p} />
        ) : (
          "—"
        )}
        {e.type === "penalty" && (
          <span className="ms-1 text-xs font-normal text-muted">{labels.pen}</span>
        )}
        {e.type === "own_goal" && (
          <span className="ms-1 text-xs font-normal text-muted">{labels.og}</span>
        )}
      </span>
      <span className="truncate text-xs text-muted">
        {e.type === "substitution" ? (
          <>
            <span className="text-loss" title={labels.off} aria-label={labels.off}>
              ▼
            </span>{" "}
            {p ? <PlayerLink p={p} /> : ""}
          </>
        ) : e.type === "goal" && rel ? (
          labels.assist(rel.name)
        ) : e.type === "yellow" ? (
          labels.yellow
        ) : e.type === "red" ? (
          labels.red
        ) : e.type === "second_yellow" ? (
          labels.secondYellow
        ) : (
          ""
        )}
      </span>
    </span>
  );
  return (
    <li className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1.5">
      <div className="flex justify-end">{isHome && body}</div>
      <div className="flex flex-col items-center">
        <span
          className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-line bg-surface px-1 text-xs ${isGoal ? "border-ink" : ""}`}
          aria-hidden="true"
        >
          {ICON[e.type]}
        </span>
        <span className="tnum mt-0.5 text-[10px] text-faint" dir="ltr">
          {minute}
        </span>
      </div>
      <div className="flex justify-start">{!isHome && body}</div>
    </li>
  );
}

function PlayerLink({ p }: { p: Player }) {
  return (
    <Link href={`/players/${p.slug}`} className="hover:underline">
      {p.name}
    </Link>
  );
}
