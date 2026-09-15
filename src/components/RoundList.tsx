import type { Competition, MatchView } from "@/lib/types";
import { dateOf, formatShortDate, type ISODate } from "@/lib/dates";
import { MatchRow } from "./MatchRow";
import { Empty } from "./Section";

/** Fixtures or results grouped by matchday, then by day inside the matchday. */
export function RoundList({
  views,
  competition,
  mode,
}: {
  views: MatchView[];
  competition: Competition;
  mode: "fixtures" | "results";
}) {
  if (views.length === 0)
    return (
      <Empty>{mode === "fixtures" ? "No fixtures left this season." : "No results yet."}</Empty>
    );
  const rounds = new Map<number, MatchView[]>();
  for (const v of views) {
    const list = rounds.get(v.match.round) ?? [];
    list.push(v);
    rounds.set(v.match.round, list);
  }
  const ordered = [...rounds.entries()].sort((a, b) =>
    mode === "fixtures" ? a[0] - b[0] : b[0] - a[0],
  );
  return (
    <div className="space-y-6">
      {ordered.map(([round, list]) => {
        const days = new Map<ISODate, MatchView[]>();
        for (const v of list
          .slice()
          .sort((a, b) => a.match.kickoff.localeCompare(b.match.kickoff))) {
          const d = dateOf(v.match.kickoff);
          const arr = days.get(d) ?? [];
          arr.push(v);
          days.set(d, arr);
        }
        return (
          <section key={round} className="space-y-2" id={`md-${round}`}>
            <h2 className="text-sm font-semibold">
              Matchday {round}
              {competition.kind === "cup" && (
                <span className="ms-2 font-normal text-faint">{list[0].match.stage}</span>
              )}
            </h2>
            <div className="card overflow-hidden">
              {[...days.entries()].map(([d, arr]) => (
                <div key={d}>
                  <div className="border-b border-line bg-surface-2/60 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
                    {formatShortDate(d)}
                  </div>
                  <div className="divide-y divide-line">
                    {arr.map((v) => (
                      <MatchRow key={v.match.id} view={v} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
