import type { Team } from "./types";

/**
 * Two colours a reader can tell apart.
 *
 * The bars are keyed by club colour, which fails exactly where it matters
 * most: Liverpool against Manchester United is two reds, and a chart in one
 * colour says nothing. Where the primaries are too close the away side takes
 * its second colour, and if that is no better it takes a neutral — the home
 * club keeps its own, so the side you are looking at is never in doubt.
 */
const NEUTRAL = "var(--text-muted)";

function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function farApart(a: string, b: string): boolean {
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) return true;
  const d = Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
  return d >= 100;
}

export function barColors(home: Team, away: Team): { home: string; away: string } {
  const h = home.colors?.[0] ?? "var(--accent)";
  const first = away.colors?.[0] ?? NEUTRAL;
  if (farApart(h, first)) return { home: h, away: first };
  const second = away.colors?.[1];
  if (second && farApart(h, second)) return { home: h, away: second };
  return { home: h, away: NEUTRAL };
}
