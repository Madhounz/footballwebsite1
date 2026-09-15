/**
 * Applies pending Prisma migrations at build time, and does nothing when no
 * database is configured, so the same build command works for demo
 * deployments, CI and the live site. Wired up in vercel.json.
 *
 * Two hazards this guards against, both seen in production:
 *
 * 1. Connection poolers. Prisma takes a session-level Postgres advisory lock
 *    before migrating. Through a pooler (Neon's `-pooler` host, PgBouncer in
 *    transaction mode) the session is not stable, so the lock can be stranded
 *    on an orphaned backend and every later migration times out on it. We
 *    migrate over the direct host instead, and clear a stranded lock first.
 *
 * 2. Two migrators at once. Only this script migrates; the sync workflow no
 *    longer does. A concurrent deploy is still possible, so failures retry.
 */
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** The lock id Prisma Migrate uses. Appears in its P1002 timeout message. */
const ADVISORY_LOCK_ID = 72707369;
const ATTEMPTS = 4;
/** A lock held by a session idle this long is stranded, not in use. */
const STRANDED_AFTER = "2 minutes";

/**
 * The host to migrate over. `DIRECT_DATABASE_URL` wins; otherwise a Neon-style
 * pooler host is rewritten to its direct twin. Anything else is left alone.
 */
/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ url: string | undefined, rewritten: boolean, direct: boolean }}
 */
export function migrationUrl(env = process.env) {
  if (env.DIRECT_DATABASE_URL)
    return { url: env.DIRECT_DATABASE_URL, rewritten: false, direct: true };
  const url = env.DATABASE_URL;
  if (!url) return { url: undefined, rewritten: false, direct: false };
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("-pooler.")) {
      parsed.hostname = parsed.hostname.replace("-pooler.", ".");
      return { url: parsed.toString(), rewritten: true, direct: true };
    }
  } catch {
    // Not a URL we can parse; use it as given.
  }
  return { url, rewritten: false, direct: false };
}

/**
 * Frees the migrate lock if a previous run died holding it. Only touches
 * sessions that are idle and have been for a while, so a migration actually in
 * progress elsewhere is left alone. Never throws: this is opportunistic.
 */
async function clearStrandedLock(url) {
  let client;
  try {
    const { default: pg } = await import("pg");
    client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 8000 });
    await client.connect();
    const { rows } = await client.query(
      `SELECT a.pid
         FROM pg_locks l
         JOIN pg_stat_activity a ON a.pid = l.pid
        WHERE l.locktype = 'advisory'
          AND l.objid = $1
          AND l.granted
          AND a.pid <> pg_backend_pid()
          AND a.state = 'idle'
          AND a.state_change < now() - $2::interval`,
      [ADVISORY_LOCK_ID, STRANDED_AFTER],
    );
    for (const { pid } of rows) {
      await client.query("SELECT pg_terminate_backend($1)", [pid]);
      console.log(`migrate: released a stranded migration lock held by idle session ${pid}`);
    }
  } catch (e) {
    console.log(
      `migrate: could not check for a stranded lock (${e instanceof Error ? e.message : e})`,
    );
  } finally {
    await client?.end().catch(() => {});
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { url, rewritten } = migrationUrl();
  if (!url) {
    console.log("migrate: DATABASE_URL not set, skipping migrations");
    return 0;
  }
  if (rewritten) {
    console.log("migrate: using the direct host; advisory locks are unreliable through a pooler");
  }
  const env = { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url };

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    await clearStrandedLock(url);
    const result = spawnSync("pnpm", ["prisma", "migrate", "deploy"], { stdio: "inherit", env });
    if (result.status === 0) return 0;
    if (attempt === ATTEMPTS) {
      console.error(`migrate: still failing after ${ATTEMPTS} attempts`);
      return result.status ?? 1;
    }
    const wait = attempt * 5000;
    console.log(`migrate: attempt ${attempt} failed, retrying in ${wait / 1000}s`);
    await sleep(wait);
  }
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main());
}
