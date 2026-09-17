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

function farApart(a: string, b: string, min = 100): boolean {
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) return true;
  const d = Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
  return d >= min;
}

/**
 * Colours for several clubs at once, all of them telling apart.
 *
 * Two clubs are handled by `barColors`; a chart with eight lines on it is a
 * harder problem, because Arsenal, Liverpool and Manchester United are the
 * same red and a reader cannot be asked to guess. Each club is offered its
 * first colour, then its second, and if both are too close to a colour already
 * on the chart it takes one from a fixed spare palette. Walking the clubs in a
 * fixed order keeps it deterministic: the same table always produces the same
 * chart.
 *
 * The threshold is lower than the two-club one. With eight lines, insisting on
 * the same distance would spend the spare palette on clubs whose own colours
 * were perfectly distinguishable.
 */
/**
 * Spare colours, generated rather than listed: a fixed palette runs out, and
 * on the day a competition has nine clubs in red it would hand two of them the
 * same spare. Successive hues a golden angle apart never repeat and never
 * cluster, so there is always another one.
 */
function spareColor(i: number): string {
  return hslToHex((i * 137.508) % 360, 0.62, 0.55);
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/**
 * Whether two lines on one chart can be told apart.
 *
 * Distance in RGB is not the question a reader is asking. Brighton's blue and
 * Chelsea's blue, one lightened until the arithmetic called them far apart,
 * were still two blue lines on a chart about following one club. So the test
 * is the hue: a different family of colour, or — for two shades of the same —
 * a gap in lightness wide enough that nobody would call them the same colour.
 */
function tellApart(a: string, b: string): boolean {
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) return true;
  const [ha, , la] = rgbToHsl(x);
  const [hb, , lb] = rgbToHsl(y);
  const dh = Math.abs(ha - hb);
  if (Math.min(dh, 360 - dh) >= 35) return true;
  return Math.abs(la - lb) >= 0.34;
}

/**
 * A club's colour, made visible on both themes without ceasing to be theirs.
 *
 * Club colours are not chosen to be drawn as thin lines over a background: a
 * second colour is very often white, which the light theme swallows whole, and
 * a navy primary is nearly invisible on the dark one. Rather than refuse them,
 * the hue is kept and only the lightness is pulled into a band that works over
 * both — Dortmund stay yellow, Everton stay blue, and both can be seen.
 *
 * White, black and the greys have no hue to keep, so nothing can be done with
 * them and the club takes a spare instead.
 */
function asLineColor(hex: string, shift = 0): string | null {
  const c = rgb(hex);
  if (!c) return null;
  const [h, s, l] = rgbToHsl(c);
  if (s < 0.15) return null;
  const adjusted = Math.min(0.68, Math.max(0.35, l + shift));
  return adjusted === l ? hex : hslToHex(h, s, adjusted);
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const [x, y, z] = [r / 255, g / 255, b / 255];
  const max = Math.max(x, y, z);
  const min = Math.min(x, y, z);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === x ? (y - z) / d + (y < z ? 6 : 0) : max === y ? (z - x) / d + 2 : (x - y) / d + 4;
  return [h * 60, s, l];
}

export function distinctColors(
  clubs: { id: string; colors?: readonly string[] }[],
): Map<string, string> {
  const used: string[] = [];
  const out = new Map<string, string>();
  let spare = 0;
  for (const club of clubs) {
    // Both of its own colours at their own shade first — Manchester United's
    // yellow is more theirs than a paler version of their red — and only then
    // the same colours lightened or deepened. Brighton and Chelsea are both
    // blue and one of them has to give, but another shade of blue is still
    // Chelsea's, which a colour off a spare wheel is not.
    const worn = [club.colors?.[0], club.colors?.[1]].filter((c): c is string => Boolean(c));
    const own = [
      ...worn.map((c) => asLineColor(c)),
      ...worn.flatMap((c) => [asLineColor(c, 0.28), asLineColor(c, -0.28)]),
    ].filter((c): c is string => Boolean(c));
    let colour = own.find((c) => used.every((u) => tellApart(u, c)));
    if (!colour) {
      // The first spare nobody is already using. The search is bounded so a
      // pathological table cannot spin here; past that it takes the next one,
      // because a colour close to another still beats two identical lines.
      while (spare < 64 && !used.every((u) => tellApart(u, spareColor(spare)))) spare++;
      colour = spareColor(spare++);
    }
    used.push(colour);
    out.set(club.id, colour);
  }
  return out;
}

/**
 * One colour to carry a club across a card: its spine, its wash, its accent.
 *
 * The same problem as a chart line, one club at a time. A kit colour is chosen
 * to look good on a shirt, not on a page that is sometimes black and
 * sometimes paper: a navy vanishes into one theme and a white into the other.
 * The hue is kept and the lightness pulled into a band that survives both.
 * Clubs who play in white, black or grey have no hue to keep, and get null —
 * a card in the site's own accent beats one in a colour nobody can see.
 */
export function clubTint(colors: readonly string[] | undefined): string | null {
  for (const hex of colors ?? []) {
    const usable = asLineColor(hex);
    if (usable) return usable;
  }
  return null;
}

export function barColors(home: Team, away: Team): { home: string; away: string } {
  const h = home.colors?.[0] ?? "var(--accent)";
  const first = away.colors?.[0] ?? NEUTRAL;
  if (farApart(h, first)) return { home: h, away: first };
  const second = away.colors?.[1];
  if (second && farApart(h, second)) return { home: h, away: second };
  return { home: h, away: NEUTRAL };
}

/**
 * Black or white, whichever can be read on that colour.
 *
 * Relative luminance rather than a brightness average, because the eye is not
 * evenly sensitive: a saturated yellow and a saturated blue of the same
 * "brightness" need opposite ink.
 */
export function readableOn(hex: string): "#111" | "#fff" {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim());
  if (!m) return "#fff";
  const h = m[1];
  const parts =
    h.length === 3
      ? [...h].map((c) => parseInt(c + c, 16))
      : [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = parts.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#111" : "#fff";
}
