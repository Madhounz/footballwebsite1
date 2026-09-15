// Applies pending Prisma migrations when a database is configured, and does
// nothing otherwise, so the same build command works for demo deployments,
// CI and the live site. Used by vercel.json.
import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.log("migrate-if-db: DATABASE_URL not set, skipping migrations");
  process.exit(0);
}
const r = spawnSync("pnpm", ["prisma", "migrate", "deploy"], { stdio: "inherit" });
process.exit(r.status ?? 1);
