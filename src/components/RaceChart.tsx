import { getLocale, getTranslations } from "next-intl/server";
import type { Race } from "@/lib/data/race";
import { distinctColors } from "@/lib/colors";
import { teamShortName } from "@/lib/i18n/names";
import type { Competition, Team } from "@/lib/types";

/**
 * A whole season, all at once.
 *
 * Every club's place after every round. The table on the front page is
 * tonight's photograph; this is the film, and it answers the questions a table
 * cannot be asked — when the leaders went clear, how long the club in
 * seventeenth has been in trouble, which climb happened in a fortnight.
 *
 * Every line is a fact: the same replay a club's own page draws from, which is
 * the same function the table itself uses. Nothing is smoothed, weighted or
 * guessed at.
 *
 * Drawing twenty lines legibly is the whole problem, and the answer is not to
 * shout all twenty at once. The clubs in the qualifying places are drawn in
 * colours picked to be told apart; everyone else sits behind them in grey and
 * comes forward when pointed at. On a phone, where nothing can be pointed at,
 * the legend under the chart carries the same colours.
 */
const W = 640;
const PAD_X = 6;
/** Room at the end of the chart for the labels on the coloured lines. */
const PAD_END = 34;
const PAD_Y = 10;
const ROW = 11;

export async function RaceChart({
  race,
  teams,
  competition,
}: {
  race: Race;
  teams: Map<string, Team>;
  competition: Competition;
}) {
  const t = await getTranslations("league");
  const locale = await getLocale();
  if (race.lines.length === 0 || race.rounds.length < 2) return null;

  const places = race.places;
  const H = Math.min(430, Math.max(150, places * ROW));
  const step = places > 1 ? (H - PAD_Y * 2) / (places - 1) : 0;
  const rounds = race.rounds;
  const x = (round: number) =>
    PAD_X + ((W - PAD_X - PAD_END) * rounds.indexOf(round)) / Math.max(1, rounds.length - 1);
  const y = (position: number) => PAD_Y + step * (position - 1);

  // The places worth being in, and the places nobody wants, behind everything.
  const bands = competition.zones
    .filter((z) => z.tone === "top" || z.tone === "bottom")
    .map((z) => ({
      tone: z.tone,
      y: Math.max(0, y(z.from) - step / 2),
      height: Math.min(H, y(z.to) + step / 2) - Math.max(0, y(z.from) - step / 2),
    }));

  // Only the clubs in the qualifying places carry a colour; that is what the
  // race is about, and twenty colours is a chart nobody can read.
  const topZone = competition.zones.find((z) => z.tone === "top");
  const highlighted = race.lines.filter((l) => !topZone || l.current <= topZone.to);
  const colours = distinctColors(
    highlighted.map((l) => ({ id: l.teamId, colors: teams.get(l.teamId)?.colors })),
  );

  return (
    <div className="card px-3 py-3 sm:px-4" dir="ltr">
      <div className="flex gap-2">
        <div className="tnum flex shrink-0 flex-col justify-between py-[2px] text-[10px] leading-none text-faint">
          <span>1</span>
          <span>{places}</span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="race h-auto w-full"
          role="img"
          aria-label={t("raceAria", { n: race.lines.length, rounds: rounds.length })}
        >
          {bands.map((b) => (
            <rect
              key={b.tone}
              x="0"
              y={b.y}
              width={W}
              height={b.height}
              fill={b.tone === "top" ? "var(--accent)" : "var(--loss)"}
              opacity="0.08"
            />
          ))}
          {race.lines.map((line) => {
            const colour = colours.get(line.teamId);
            const team = teams.get(line.teamId);
            const d = line.points.map(
              (p) => `${x(p.round).toFixed(1)},${y(p.position).toFixed(1)}`,
            );
            const last = line.points[line.points.length - 1];
            return (
              <g key={line.teamId} className="race-club">
                {/* A transparent stroke wide enough to be pointed at without
                    making the drawn line any thicker. */}
                <polyline
                  points={d.join(" ")}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="12"
                  pointerEvents="stroke"
                />
                <polyline
                  className="race-stroke"
                  points={d.join(" ")}
                  fill="none"
                  stroke={colour ?? "var(--text-faint)"}
                  strokeOpacity={colour ? 1 : 0.32}
                  strokeWidth={colour ? 2.5 : 1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx={x(last.round)}
                  cy={y(last.position)}
                  r={colour ? 3.5 : 2}
                  fill={colour ?? "var(--text-faint)"}
                  fillOpacity={colour ? 1 : 0.32}
                />
                {team && (
                  <text
                    className={colour ? "race-endlabel" : "race-name"}
                    x={x(last.round) + 7}
                    y={y(last.position) + 3}
                    fill={colour ?? "var(--text-muted)"}
                    fontSize="9"
                    fontWeight="600"
                  >
                    {team.code.slice(0, 3)}
                  </text>
                )}
                <title>{`${team ? teamShortName(team, locale) : line.teamId} — ${t("racePlace", { position: last.position, points: last.points })}`}</title>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="tnum mt-2 flex justify-between text-[10px] leading-none text-faint">
        <span>{t("raceRound", { n: rounds[0] })}</span>
        <span>{t("raceRound", { n: rounds[rounds.length - 1] })}</span>
      </div>
    </div>
  );
}

/** The key: who is which colour, in the order they stand tonight. */
export async function RaceKey({
  race,
  teams,
  competition,
}: {
  race: Race;
  teams: Map<string, Team>;
  competition: Competition;
}) {
  const locale = await getLocale();
  const topZone = competition.zones.find((z) => z.tone === "top");
  const highlighted = race.lines.filter((l) => !topZone || l.current <= topZone.to);
  const colours = distinctColors(
    highlighted.map((l) => ({ id: l.teamId, colors: teams.get(l.teamId)?.colors })),
  );
  if (highlighted.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
      {highlighted.map((line) => {
        const team = teams.get(line.teamId);
        if (!team) return null;
        return (
          <li key={line.teamId} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block h-[3px] w-4 rounded-full"
              style={{ backgroundColor: colours.get(line.teamId) }}
              aria-hidden="true"
            />
            <span className="tnum text-faint">{line.current}</span>
            <span>{teamShortName(team, locale)}</span>
          </li>
        );
      })}
    </ul>
  );
}
