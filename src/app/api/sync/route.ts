import { timingSafeEqual } from "node:crypto";
import { runLiveRefresh } from "@/lib/pipeline/live";

/**
 * Refreshes today's matches. Called every minute by an external cron service,
 * because GitHub's scheduler drops short-interval runs and a scores site needs
 * to be right within a minute.
 *
 * Authenticate with either
 *   Authorization: Bearer <SYNC_SECRET>        (preferred)
 *   ?key=<SYNC_SECRET>                          (for cron services without custom headers)
 *
 * Responds 200 when work was done, 202 when the run was deliberately skipped
 * (another run in flight, nothing seeded yet), so a monitor can tell the two apart.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request): Promise<Response> {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return json({ ok: false, error: "SYNC_SECRET is not set on this deployment" }, 503);
  if (!authorized(req, secret)) return json({ ok: false, error: "unauthorized" }, 401);
  if ((process.env.DATA_SOURCE ?? "demo") !== "db") {
    return json({ ok: false, error: "DATA_SOURCE is not 'db'; there is nothing to refresh" }, 409);
  }

  const log: string[] = [];
  const force = new URL(req.url).searchParams.get("force") === "1";
  try {
    const outcome = await runLiveRefresh({ trigger: "cron", force, log: (l) => log.push(l) });
    return json({ ok: true, ...outcome, log }, outcome.ran ? 200 : 202);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e), log }, 500);
  }
}

function authorized(req: Request, secret: string): boolean {
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const query = new URL(req.url).searchParams.get("key") ?? "";
  return equals(bearer, secret) || equals(query, secret);
}

/** Constant-time compare so the secret cannot be guessed a character at a time. */
function equals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
