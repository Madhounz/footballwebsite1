import Link from "next/link";
import type { Competition, MatchView } from "@/lib/types";
import { MatchRow } from "./MatchRow";

/** Matches grouped by competition, in competition order. */
export function MatchList({
  views,
  competitions,
  showRound = false,
  emptyText = "No matches.",
}: {
  views: MatchView[];
  competitions: Competition[];
  showRound?: boolean;
  emptyText?: string;
}) {
  if (views.length === 0) {
    return <div className="card px-6 py-12 text-center text-sm text-muted">{emptyText}</div>;
  }
  const groups = competitions
    .map((c) => ({ competition: c, views: views.filter((v) => v.competition.id === c.id) }))
    .filter((g) => g.views.length > 0);

  return (
    <div className="space-y-4">
      {groups.map(({ competition, views }) => {
        const liveCount = views.filter((v) => v.match.status === "live").length;
        const round = views[0]?.match.round;
        return (
          <section
            key={competition.id}
            className="card overflow-hidden"
            aria-labelledby={`comp-${competition.id}`}
          >
            <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <Link
                href={`/leagues/${competition.slug}`}
                id={`comp-${competition.id}`}
                className="flex items-center gap-2 text-sm font-semibold hover:underline"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: competition.color }}
                  aria-hidden="true"
                />
                {competition.name}
                <span className="hidden font-normal text-faint sm:inline">
                  {competition.kind === "cup"
                    ? `· ${views[0].match.stage ?? ""} · MD ${round}`
                    : `· Matchday ${round}`}
                </span>
              </Link>
              <span className="flex items-center gap-3 text-xs text-muted">
                {liveCount > 0 && (
                  <span className="flex items-center gap-1.5 font-medium text-live">
                    <span className="live-dot" /> {liveCount} live
                  </span>
                )}
                <Link href={`/leagues/${competition.slug}`} className="hover:text-ink">
                  Table →
                </Link>
              </span>
            </header>
            <div className="divide-y divide-line">
              {views.map((v) => (
                <MatchRow key={v.match.id} view={v} showRound={showRound} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
