/**
 * Share cards. Every match, team, competition and player renders a 1200×630 PNG
 * so a link pasted into a group chat arrives with the crests and the score on
 * it, which is how a scores site actually travels.
 *
 * Satori (behind `ImageResponse`) is not a browser. Three rules follow:
 *   - flexbox only, and every element needs an explicit `display`;
 *   - no `gap` — spacing is margins, so rows are built from item lists here
 *     rather than assembled ad hoc at each call site;
 *   - it cannot rasterise an SVG crest or wait on a slow provider, so crests
 *     are fetched with a timeout and fall back to the same colour badge the
 *     site itself uses.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";
import type { Team } from "@/lib/types";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/** The dark half of the palette in `globals.css`: a card that reads on any background. */
export const OG = {
  bg: "#0f0f0e",
  surface: "#171716",
  line: "#3a3a36",
  text: "#f2f2ef",
  muted: "#9a9a93",
  faint: "#6d6d67",
  accent: "#34d399",
  live: "#4ade80",
};

/** Match cards follow the score; the rest change about as often as a season. */
export const OG_CACHE = {
  live: "public, max-age=60, s-maxage=60, stale-while-revalidate=600",
  stable: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
};

type FontWeight = 400 | 700;
interface OgFont {
  name: string;
  data: Buffer;
  weight: FontWeight;
  style: "normal";
}

/**
 * Satori's built-in face has no Arabic glyphs, so the Arabic card ships its
 * own; English keeps the built-in one. Cairo rather than Noto Sans Arabic:
 * satori's shaper rejects the substitution table Noto's current release uses.
 * The files are traced into the deployment by `outputFileTracingIncludes` in
 * `next.config.ts`. A missing font costs the Arabic lettering, never the card:
 * the caller renders without it.
 */
export async function ogFonts(locale: string): Promise<OgFont[] | undefined> {
  if (locale !== "ar") return undefined;
  const dir = path.join(process.cwd(), "src/app/og");
  try {
    const [regular, bold] = await Promise.all([
      readFile(path.join(dir, "Cairo-Regular.ttf")),
      readFile(path.join(dir, "Cairo-Bold.ttf")),
    ]);
    return [
      { name: "Cairo", data: regular, weight: 400, style: "normal" },
      { name: "Cairo", data: bold, weight: 700, style: "normal" },
    ];
  } catch {
    return undefined;
  }
}

/**
 * Crest bytes as a data URI. Only raster formats: satori cannot rasterise the
 * SVG crests some providers hand out. A slow or broken provider must not cost
 * us the card, so this gives up quickly and lets the badge take over.
 */
export async function loadCrest(url: string | undefined): Promise<string | null> {
  if (!url || !/\.(png|jpe?g)(\?|$)/i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!/image\/(png|jpeg)/.test(type)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Satori shapes each Arabic word correctly but has no bidi algorithm: it lays
 * words out in logical order, so an Arabic line reads backwards and the spaces
 * land against the wrong word. Laying each word out as its own box in a
 * reversed row sidesteps both. Latin text — a stadium name, a player's name —
 * is left exactly as it is, in either language.
 */
export function Words({ children, dir }: { children: string; dir: "ltr" | "rtl" }) {
  if (dir !== "rtl" || !/[\u0600-\u06FF]/.test(children)) return <>{children}</>;
  const words = children.trim().split(/\s+/);
  return (
    <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "baseline" }}>
      {words.map((w, i) => (
        <div key={i} style={{ display: "flex", marginRight: i > 0 ? 10 : 0 }}>
          {w}
        </div>
      ))}
    </div>
  );
}

/** The club's crest, or its colours — never a broken image. */
export function Crest({ team, src, size }: { team: Team; src: string | null; size: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} width={size} height={size} alt="" style={{ objectFit: "contain" }} />;
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size / 2,
        background: team.colors[0],
        color: readable(team.colors[0]),
        fontSize: size * 0.36,
        fontWeight: 700,
        border: `${Math.max(2, size * 0.025)}px solid ${team.colors[1] ?? "#00000022"}`,
      }}
    >
      {initials(team)}
    </div>
  );
}

/**
 * A row of items separated by a dot. Empty items drop out, so a card never
 * shows a separator with nothing after it.
 */
export function Row({
  items,
  size,
  color,
  dir = "ltr",
  justify = "center",
}: {
  items: ReactNode[];
  size: number;
  color: string;
  dir?: "ltr" | "rtl";
  justify?: "center" | "flex-start";
}) {
  const shown = items.filter((i) => i !== null && i !== undefined && i !== false && i !== "");
  return (
    <div
      style={{
        display: "flex",
        flexDirection: dir === "rtl" ? "row-reverse" : "row",
        alignItems: "center",
        justifyContent: justify,
        fontSize: size,
        color,
      }}
    >
      {shown.map((item, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            flexDirection: dir === "rtl" ? "row-reverse" : "row",
            alignItems: "center",
          }}
        >
          {i > 0 && <div style={{ display: "flex", margin: "0 12px", color: OG.line }}>·</div>}
          <div
            style={{
              display: "flex",
              flexDirection: dir === "rtl" ? "row-reverse" : "row",
              alignItems: "center",
            }}
          >
            {item}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Card frame: a rule in the competition's colour, the wordmark, and two rows of context. */
export function Card({
  accent = OG.accent,
  eyebrow = [],
  children,
  footer = [],
  footerSize = 26,
  dir = "ltr",
}: {
  accent?: string;
  eyebrow?: ReactNode[];
  children: ReactNode;
  footer?: ReactNode[];
  /** Smaller where a card lists many things, so the row never runs off the edge. */
  footerSize?: number;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: OG.bg,
        color: OG.text,
        padding: 56,
        borderTop: `10px solid ${accent}`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: dir === "rtl" ? "row-reverse" : "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Row items={eyebrow} size={26} color={OG.muted} dir={dir} justify="flex-start" />
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontSize: 30,
            fontWeight: 700,
            color: OG.text,
            letterSpacing: dir === "rtl" ? 0 : "-0.03em",
          }}
        >
          ninety
          <div style={{ display: "flex", color: accent }}>.</div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
        }}
      >
        {children}
      </div>
      <Row items={footer} size={footerSize} color={OG.faint} dir={dir} />
    </div>
  );
}

function initials(team: Team): string {
  const words = team.shortName.split(/\s+/).filter(Boolean);
  const letters = (words.length > 1 ? words.map((w) => w[0]).join("") : team.shortName.slice(0, 3))
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 3);
  return (letters || team.code || team.shortName.slice(0, 2)).toUpperCase();
}

/** Black or white, whichever the club colour can carry. */
function readable(hex: string): string {
  const h = hex.replace("#", "");
  const n =
    h.length === 3
      ? [...h].map((c) => parseInt(c + c, 16))
      : [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = n.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#111" : "#fff";
}
