import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Player, TeamLineup, Team } from "@/lib/types";
import { teamShortName } from "@/lib/i18n/names";

/**
 * SVG pitch with the starting XI placed by formation. Home attacks upward from
 * the bottom half, away downward from the top half — the familiar broadcast view.
 */
export async function LineupPitch({
  home,
  away,
  homeTeam,
  awayTeam,
  players,
}: {
  home: TeamLineup;
  away: TeamLineup;
  homeTeam: Team;
  awayTeam: Team;
  players: Record<string, Player>;
}) {
  const t = await getTranslations("match");
  const locale = await getLocale();
  const W = 100;
  const H = 150;
  const place = (lineup: TeamLineup, side: "home" | "away") => {
    const lines = [1, ...lineup.formation.split("-").map(Number)];
    const total = lines.length;
    return lineup.starting.map((lp) => {
      const [rowStr, colStr] = lp.grid.split(":");
      const row = Number(rowStr) - 1;
      const col = Number(colStr) - 1;
      const n = lines[row] ?? 1;
      const x = ((col + 1) / (n + 1)) * W;
      const depth = total <= 1 ? 0.5 : row / (total - 1);
      const yHalf = 8 + depth * (H / 2 - 18);
      const y = side === "home" ? H - yHalf : yHalf;
      return { ...lp, x, y };
    });
  };
  const homeDots = place(home, "home");
  const awayDots = place(away, "away");

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-2 border-b border-line text-sm">
        <div className="flex items-center gap-2 px-4 py-2.5 font-medium">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: homeTeam.colors[0] }} />
          {teamShortName(homeTeam, locale)}{" "}
          <span className="text-faint" dir="ltr">
            {home.formation}
          </span>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 font-medium">
          <span className="text-faint" dir="ltr">
            {away.formation}
          </span>{" "}
          {teamShortName(awayTeam, locale)}
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: awayTeam.colors[0] }} />
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        role="img"
        aria-label={t("startingLineups")}
      >
        <defs>
          <linearGradient id="grass" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#2f7d4f" />
            <stop offset="1" stopColor="#2a6f46" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#grass)" />
        {Array.from({ length: 10 }).map((_, i) => (
          <rect
            key={i}
            x={0}
            y={(i * H) / 10}
            width={W}
            height={H / 10}
            fill={i % 2 ? "rgba(255,255,255,0.035)" : "transparent"}
          />
        ))}
        <g fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={0.6}>
          <rect x={3} y={3} width={W - 6} height={H - 6} />
          <line x1={3} x2={W - 3} y1={H / 2} y2={H / 2} />
          <circle cx={W / 2} cy={H / 2} r={9} />
          <rect x={W / 2 - 22} y={3} width={44} height={17} />
          <rect x={W / 2 - 10} y={3} width={20} height={6} />
          <rect x={W / 2 - 22} y={H - 20} width={44} height={17} />
          <rect x={W / 2 - 10} y={H - 9} width={20} height={6} />
        </g>
        {[
          ...awayDots.map((d) => ({ ...d, team: awayTeam })),
          ...homeDots.map((d) => ({ ...d, team: homeTeam })),
        ].map((d) => {
          const p = players[d.playerId];
          const isGK = d.position === "GK";
          const fill = isGK ? "#f3d34a" : d.team.colors[0];
          const text = luminance(fill) > 0.5 ? "#111" : "#fff";
          return (
            <g key={d.playerId}>
              <circle
                cx={d.x}
                cy={d.y}
                r={4.2}
                fill={fill}
                stroke="rgba(0,0,0,0.35)"
                strokeWidth={0.4}
              />
              <text
                x={d.x}
                y={d.y + 1.3}
                textAnchor="middle"
                fontSize={3.6}
                fontWeight={700}
                fill={text}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                {d.shirtNumber}
              </text>
              <text
                x={d.x}
                y={d.y + 8.2}
                textAnchor="middle"
                fontSize={3}
                fill="#fff"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.45)", strokeWidth: 0.6 }}
              >
                {p ? shortName(p) : ""}
                {d.captain ? " (c)" : ""}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="grid grid-cols-2 divide-x divide-line border-t border-line text-sm">
        <Bench
          lineup={home}
          players={players}
          benchLabel={t("bench")}
          coachLabel={(n) => t("coach", { name: n })}
        />
        <Bench
          lineup={away}
          players={players}
          align="end"
          benchLabel={t("bench")}
          coachLabel={(n) => t("coach", { name: n })}
        />
      </div>
    </div>
  );
}

function Bench({
  lineup,
  players,
  align = "start",
  benchLabel,
  coachLabel,
}: {
  lineup: TeamLineup;
  players: Record<string, Player>;
  align?: "start" | "end";
  benchLabel: string;
  coachLabel: (n: string) => string;
}) {
  return (
    <div className={`px-4 py-3 ${align === "end" ? "text-end" : ""}`}>
      <div className="mb-1.5 text-[11px] uppercase tracking-wide text-faint">{benchLabel}</div>
      <ul className="space-y-1">
        {lineup.bench.map((b) => {
          const p = players[b.playerId];
          return (
            <li key={b.playerId} className="tnum text-[13px]">
              <span className="text-faint">{b.shirtNumber}</span>{" "}
              {p ? (
                <Link href={`/players/${p.slug}`} className="hover:underline">
                  {p.name}
                </Link>
              ) : (
                "—"
              )}
              <span className="ms-1 text-faint">{b.position}</span>
            </li>
          );
        })}
      </ul>
      {lineup.coach && <div className="mt-2 text-xs text-muted">{coachLabel(lineup.coach)}</div>}
    </div>
  );
}

function shortName(p: Player): string {
  return p.lastName.length > 12 ? `${p.lastName.slice(0, 11)}…` : p.lastName;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
