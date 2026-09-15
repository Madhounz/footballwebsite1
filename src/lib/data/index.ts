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

export type { Repository, MatchDetail, TeamHonour } from "./repository";
