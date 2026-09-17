"use client";

import { useState } from "react";
import type { Team } from "@/lib/types";
import { readableOn } from "@/lib/colors";

/**
 * Only what a crest is drawn from. Taking the whole `Team` would mean a club
 * arriving from an API route — with a name, a crest and its colours, and no
 * stadium or founding year — could not be drawn, for no reason at all.
 */
export type CrestTeam = Pick<Team, "colors" | "code"> & { crestUrl?: string | null };

/**
 * A club crest. Uses the provider's official image when the team has one and
 * it loads; otherwise a generated badge from the club colours and code, which
 * is also what the demo dataset shows.
 */
export function TeamCrest({
  team,
  size = 28,
  className = "",
}: {
  team: CrestTeam;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (team.crestUrl && !failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center ${className}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- remote SVG/PNG of unknown size; next/image adds nothing here */}
        <img
          src={team.crestUrl}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ width: size, height: size, objectFit: "contain" }}
        />
      </span>
    );
  }
  return <GeneratedCrest team={team} size={size} className={className} />;
}

/**
 * The badge a club falls back to.
 *
 * The second colour is a ring, not a diagonal across the face. Split
 * diagonally, the letters sat on both halves at once and whichever half was
 * near the ink lost them: Chelsea's blue and white swallowed the E, Villarreal's
 * yellow and navy swallowed the L. A club's code is the whole point of the
 * badge, so the face stays one colour, the ink is chosen against that colour
 * alone, and the second colour keeps its place around the edge — which is also
 * exactly how the crest on a share card is drawn.
 */
export function GeneratedCrest({
  team,
  size,
  className = "",
}: {
  team: CrestTeam;
  size: number;
  className?: string;
}) {
  const [a, b] = team.colors;
  const ring = Math.max(1, Math.round(size * 0.06));
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        background: a,
        color: readableOn(a),
        fontSize: Math.max(8, Math.round(size * 0.32)),
        letterSpacing: "-0.02em",
        // The ring sits inside the circle, so the badge keeps the size it was
        // given and still lines up with a provider crest beside it.
        boxShadow: `inset 0 0 0 ${ring}px ${b ?? "rgb(0 0 0 / 0.12)"}, inset 0 0 0 ${ring + 1}px rgb(0 0 0 / 0.12)`,
      }}
      aria-hidden="true"
    >
      {team.code.slice(0, 3)}
    </span>
  );
}
