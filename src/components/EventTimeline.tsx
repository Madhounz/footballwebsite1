import Link from "next/link";
import type { MatchEvent, Player, Team } from "@/lib/types";

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

/** Two-sided timeline: home events to the left of the spine, away to the right. */
export function EventTimeline({
  events,
  home,
  away,
  players,
  halfTime,
}: {
  events: MatchEvent[];
  home: Team;
  away: Team;
  players: Record<string, Player>;
  halfTime: { home: number; away: number } | null;
}) {
  if (events.length === 0) {
    return <div className="card px-6 py-10 text-center text-sm text-muted">No events yet.</div>;
  }
  const first = events.filter((e) => e.minute <= 45);
  const second = events.filter((e) => e.minute > 45);
  return (
    <div className="card px-3 py-4 sm:px-6">
      <ol className="relative space-y-1">
        <span
          className="absolute inset-y-0 start-1/2 w-px -translate-x-1/2 bg-line"
          aria-hidden="true"
        />
        {first.map((e) => (
          <Item key={e.id} e={e} isHome={e.teamId === home.id} players={players} />
        ))}
        {halfTime && (
          <li className="relative flex justify-center py-2">
            <span className="tnum rounded-full border border-line bg-surface px-3 py-0.5 text-[11px] font-medium text-muted">
              HT {halfTime.home}–{halfTime.away}
            </span>
          </li>
        )}
        {second.map((e) => (
          <Item key={e.id} e={e} isHome={e.teamId === home.id} players={players} />
        ))}
      </ol>
      <div className="mt-3 flex justify-between text-[11px] text-faint">
        <span>{home.shortName}</span>
        <span>{away.shortName}</span>
      </div>
    </div>
  );
}

function Item({
  e,
  isHome,
  players,
}: {
  e: MatchEvent;
  isHome: boolean;
  players: Record<string, Player>;
}) {
  const p = e.playerId ? players[e.playerId] : null;
  const rel = e.relatedPlayerId ? players[e.relatedPlayerId] : null;
  const isGoal = e.type === "goal" || e.type === "penalty" || e.type === "own_goal";
  const minute = `${e.minute}${e.addedTime ? `+${e.addedTime}` : ""}'`;
  const body = (
    <span
      className={`inline-flex max-w-full flex-col ${isHome ? "items-end text-end" : "items-start"}`}
    >
      <span className={`truncate text-sm ${isGoal ? "font-semibold" : ""}`}>
        {e.type === "substitution" ? (
          <>
            <span className="text-win">▲</span> {rel ? <PlayerLink p={rel} /> : "—"}
          </>
        ) : p ? (
          <PlayerLink p={p} />
        ) : (
          "—"
        )}
        {e.type === "penalty" && <span className="ms-1 text-xs font-normal text-muted">(pen)</span>}
        {e.type === "own_goal" && <span className="ms-1 text-xs font-normal text-muted">(og)</span>}
      </span>
      <span className="truncate text-xs text-muted">
        {e.type === "substitution" ? (
          <>
            <span className="text-loss">▼</span> {p ? p.name : ""}
          </>
        ) : e.type === "goal" && rel ? (
          <>Assist: {rel.name}</>
        ) : e.type === "yellow" ? (
          "Yellow card"
        ) : e.type === "red" ? (
          "Red card"
        ) : e.type === "second_yellow" ? (
          "Second yellow"
        ) : (
          ""
        )}
      </span>
    </span>
  );
  return (
    <li className={`relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1.5`}>
      <div className="flex justify-end">{isHome && body}</div>
      <div className="flex flex-col items-center">
        <span
          className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-line bg-surface px-1 text-xs ${isGoal ? "border-ink" : ""}`}
          aria-hidden="true"
        >
          {ICON[e.type]}
        </span>
        <span className="tnum mt-0.5 text-[10px] text-faint">{minute}</span>
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
