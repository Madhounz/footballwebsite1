import type { Competition, Team } from "../types";
import teamsAr from "../../../data/i18n/teams.ar.json";
import competitionsAr from "../../../data/i18n/competitions.ar.json";

/**
 * Display names per locale. Club and competition names are the words fans
 * actually use, so they are curated rather than machine-translated; anything
 * missing falls back to the English name.
 */
const TEAMS_AR = teamsAr as unknown as Record<string, [string, string] | string>;
const COMPS_AR = competitionsAr as Record<
  string,
  { name: string; shortName: string; navName: string }
>;

export function teamName(team: Pick<Team, "id" | "name">, locale: string): string {
  if (locale === "ar") {
    const v = TEAMS_AR[team.id];
    if (Array.isArray(v)) return v[0];
  }
  return team.name;
}

export function teamShortName(team: Pick<Team, "id" | "shortName">, locale: string): string {
  if (locale === "ar") {
    const v = TEAMS_AR[team.id];
    if (Array.isArray(v)) return v[1];
  }
  return team.shortName;
}

export function competitionName(c: Pick<Competition, "id" | "name">, locale: string): string {
  return (locale === "ar" && COMPS_AR[c.id]?.name) || c.name;
}

export function competitionShortName(
  c: Pick<Competition, "id" | "shortName">,
  locale: string,
): string {
  return (locale === "ar" && COMPS_AR[c.id]?.shortName) || c.shortName;
}

/** Name used in the competition strip: "Champions League" rather than "UEFA Champions League". */
export function competitionNavName(
  c: Pick<Competition, "id" | "name" | "kind" | "shortName">,
  locale: string,
): string {
  if (locale === "ar" && COMPS_AR[c.id]?.navName) return COMPS_AR[c.id].navName;
  if (c.kind === "cup") return c.shortName === "UCL" ? "Champions League" : "Europa League";
  return c.name;
}

const SPECIAL_REGIONS: Record<string, Record<string, string>> = {
  en: {
    "GB-ENG": "England",
    "GB-SCT": "Scotland",
    "GB-WLS": "Wales",
    "GB-NIR": "Northern Ireland",
    EU: "Europe",
  },
  ar: {
    "GB-ENG": "إنجلترا",
    "GB-SCT": "اسكتلندا",
    "GB-WLS": "ويلز",
    "GB-NIR": "أيرلندا الشمالية",
    EU: "أوروبا",
  },
};

/** Country name from an ISO code; handles the UK nations and "EU" which Intl does not. */
export function countryName(code: string, locale: string, fallback = code): string {
  const special = SPECIAL_REGIONS[locale]?.[code] ?? SPECIAL_REGIONS.en[code];
  if (special) return special;
  if (!/^[A-Z]{2}$/.test(code)) return fallback;
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? fallback;
  } catch {
    return fallback;
  }
}
