import { getTranslations } from "next-intl/server";
import type { ArcPoint } from "@/lib/data/season-arc";
import type { Competition, Team } from "@/lib/types";

/**
 * A club's path through the table, drawn.
 *
 * The line is the club's position after each matchday; the dot on it is that
 * week's result. Both come from the same scorelines the table is built from,
 * so the picture cannot say anything the table would deny.
 *
 * Two bands sit behind it — the places that qualify and the places that go
 * down — because a line means nothing without knowing which parts of the
 * column are worth being in. Only those two, and nothing under the line: a
 * band for every zone would be a rainbow, the area beneath a position line
 * means nothing at all, and both bury the one mark the reader is here for.
 *
 * It is a picture of numbers, so it reads left to right in both languages, the
 * way every chart does.
 */
const W = 640;
const H = 150;
const PAD_X = 6;
const PAD_Y = 8;

export async function SeasonArc({
  points,
  team,
  competition,
}: {
  points: ArcPoint[];
  team: Team;
  competition: Competition;
}) {
  const t = await getTranslations("team");
  // Two points is a pair of dots, not a season.
  if (points.length < 3) return null;

  const places = Math.max(competition.teamCount, ...points.map((p) => p.position));
  const step = places > 1 ? (H - PAD_Y * 2) / (places - 1) : 0;
  const x = (i: number) => PAD_X + ((W - PAD_X * 2) * i) / (points.length - 1);
  const y = (position: number) => PAD_Y + step * (position - 1);
  const band = (from: number, to: number) => ({
    y: Math.max(0, y(from) - step / 2),
    height: Math.min(H, y(to) + step / 2) - Math.max(0, y(from) - step / 2),
  });

  const colour = team.colors?.[0] ?? "var(--accent)";
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.position).toFixed(1)}`).join(" ");
  const zones = competition.zones.filter((z) => z.tone === "top" || z.tone === "bottom");

  const label = t("arcAria", {
    name: team.name,
    first: points[0].position,
    last: points[points.length - 1].position,
    rounds: points.length,
  });

  return (
    <div className="card px-3 py-3 sm:px-4" dir="ltr">
      <div className="flex gap-2">
        <div className="tnum flex shrink-0 flex-col justify-between py-[2px] text-[10px] leading-none text-faint">
          <span>1</span>
          <span>{places}</span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={label}
          preserveAspectRatio="xMidYMid meet"
        >
          {zones.map((z) => {
            const b = band(z.from, z.to);
            return (
              <rect
                key={`${z.from}-${z.to}`}
                x="0"
                y={b.y}
                width={W}
                height={b.height}
                fill={z.tone === "top" ? "var(--accent)" : "var(--loss)"}
                opacity="0.09"
              />
            );
          })}
          {/* pathLength normalises the line to 1, so the draw animation needs
              no measurement — and its resting state is the whole line, which is
              what a browser refusing to animate draws. */}
          <polyline
            className="arc-line"
            points={line}
            fill="none"
            stroke={colour}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
          />
          {points.map((p, i) => (
            <circle
              key={p.round}
              className="rise"
              style={{ animationDelay: `${400 + i * 24}ms` }}
              cx={x(i)}
              cy={y(p.position)}
              r={i === points.length - 1 ? 6.5 : 4.5}
              fill={
                p.result === "W"
                  ? "var(--win)"
                  : p.result === "L"
                    ? "var(--loss)"
                    : p.result === "D"
                      ? "var(--draw)"
                      : "var(--text-faint)"
              }
              stroke="var(--surface)"
              strokeWidth="2"
            >
              <title>
                {t("arcPoint", { round: p.round, position: p.position, points: p.points })}
              </title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="tnum mt-2 flex justify-between text-[10px] leading-none text-faint">
        <span>{t("arcRound", { n: points[0].round })}</span>
        <span>{t("arcRound", { n: points[points.length - 1].round })}</span>
      </div>
    </div>
  );
}
