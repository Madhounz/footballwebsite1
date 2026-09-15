import type { Match, MatchPhase } from "./types";

/** Status text for a match row: "FT", "45+2'", "HT", "20:00", "Postponed". */
export function matchStatusLabel(m: Match, kickoffLabel: string): string {
  switch (m.status) {
    case "finished":
      return m.phase === "PEN" ? "Pens" : m.phase === "ET" ? "AET" : "FT";
    case "live":
      return livePhaseLabel(m.phase, m.minute);
    case "postponed":
      return "Postponed";
    case "cancelled":
      return "Cancelled";
    default:
      return kickoffLabel;
  }
}

export function livePhaseLabel(phase: MatchPhase, minute: number | null): string {
  if (phase === "HT") return "HT";
  if (minute == null) return "Live";
  if (phase === "1H" && minute > 45) return `45+${minute - 45}'`;
  if (phase === "2H" && minute > 90) return `90+${minute - 90}'`;
  return `${minute}'`;
}

export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export function positionLabel(p: "GK" | "DF" | "MF" | "FW"): string {
  return { GK: "Goalkeeper", DF: "Defender", MF: "Midfielder", FW: "Forward" }[p];
}

export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
