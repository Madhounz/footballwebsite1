import { normalizeName } from "./normalize";
import type { ProviderPlayerRef } from "./types";

/**
 * Matches a provider's player name against a squad. Providers abbreviate
 * ("B. Saka"), drop accents ("Odegaard") or use a single name ("Vitinha"), so
 * the match is by normalised surname with the first initial as a tie-breaker.
 * Returns null when nothing is convincing; the caller then creates the player.
 */
export interface SquadEntry {
  id: string;
  name: string;
  shirtNumber?: number;
}

export function matchPlayer(ref: ProviderPlayerRef, squad: SquadEntry[]): string | null {
  const wanted = tokens(ref.name);
  if (wanted.length === 0) return null;
  const wantedLast = wanted[wanted.length - 1];
  const wantedInitial = wanted.length > 1 ? wanted[0][0] : null;
  const wantedFull = wanted.join(" ");

  // 1. Same full normalised name.
  const exact = squad.filter((p) => tokens(p.name).join(" ") === wantedFull);
  if (exact.length === 1) return exact[0].id;

  // 2. Shirt number + surname.
  if (ref.shirtNumber) {
    const byNumber = squad.filter(
      (p) => p.shirtNumber === ref.shirtNumber && tokens(p.name).includes(wantedLast),
    );
    if (byNumber.length === 1) return byNumber[0].id;
  }

  // 3. Surname match (any token, so "Saka" hits "Bukayo Saka" and "Van Dijk" hits "Virgil van Dijk").
  const bySurname = squad.filter((p) => {
    const t = tokens(p.name);
    return t.includes(wantedLast) || t.join(" ").endsWith(wanted.slice(-2).join(" "));
  });
  if (bySurname.length === 1) return bySurname[0].id;
  if (bySurname.length > 1 && wantedInitial) {
    const byInitial = bySurname.filter((p) => tokens(p.name)[0]?.[0] === wantedInitial);
    if (byInitial.length === 1) return byInitial[0].id;
  }
  return null;
}

function tokens(name: string): string[] {
  return normalizeName(name.replace(/\./g, " "))
    .split(" ")
    .filter((t) => t.length > 0);
}
