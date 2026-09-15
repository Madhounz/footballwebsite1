import type { Honours } from "../types";
import epl from "../../../data/honours/epl.json";
import laliga from "../../../data/honours/laliga.json";
import bundesliga from "../../../data/honours/bundesliga.json";
import seriea from "../../../data/honours/seriea.json";
import ucl from "../../../data/honours/ucl.json";
import uel from "../../../data/honours/uel.json";

/**
 * Historical winners are curated data, not live data: they change once a year.
 * Kept as JSON so a reviewer can diff a season being added.
 */
const ALL: Record<string, Honours> = {
  epl: epl as Honours,
  laliga: laliga as Honours,
  bundesliga: bundesliga as Honours,
  seriea: seriea as Honours,
  ucl: ucl as Honours,
  uel: uel as Honours,
};

export function honoursFor(competitionId: string): Honours | null {
  return ALL[competitionId] ?? null;
}

export function allHonours(): Honours[] {
  return Object.values(ALL);
}
