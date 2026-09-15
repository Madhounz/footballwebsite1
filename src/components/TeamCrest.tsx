"use client";

import { useState } from "react";
import type { Team } from "@/lib/types";

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
  team: Team;
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

export function GeneratedCrest({
  team,
  size,
  className = "",
}: {
  team: Team;
  size: number;
  className?: string;
}) {
  const [a, b] = team.colors;
  const light = isLight(a);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${a} 0 60%, ${b} 60% 100%)`,
        color: light ? "#111" : "#fff",
        fontSize: Math.max(8, Math.round(size * 0.32)),
        letterSpacing: "-0.02em",
        boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.12)",
      }}
      aria-hidden="true"
    >
      {team.code.slice(0, 3)}
    </span>
  );
}

function isLight(hex: string): boolean {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 165;
}
