import { cache } from "react";
import type { ISODate } from "../dates";
import type { MatchView } from "../types";
import type { Repository } from "./repository";
import { DemoRepository } from "./demo";

/**
 * Chooses the data source once per server process.
 *   DATA_SOURCE=demo (default) -> bundled synthetic dataset
 *   DATA_SOURCE=db             -> PostgreSQL through Prisma
 */
let instance: Repository | null = null;

export async function getRepository(): Promise<Repository> {
  if (instance) return instance;
  const source = process.env.DATA_SOURCE ?? "demo";
  if (source === "db") {
    const { PrismaRepository } = await import("./prisma");
    instance = new PrismaRepository();
  } else {
    instance = new DemoRepository();
  }
  return instance;
}

/**
 * A day's matches, asked for once however many parts of the page want them.
 *
 * The header says which competitions have football on today and the day list
 * shows the matches themselves — the same query, twice, on the busiest page
 * on the site. `cache` collapses them into one for the length of a request.
 */
export const matchesOnDate = cache(async (date: ISODate): Promise<MatchView[]> =>
  (await getRepository()).getMatchesOnDate(date),
);

export type { Repository, MatchDetail, TeamHonour } from "./repository";
