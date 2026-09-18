import { cookies } from "next/headers";
import { isTimeZone, todayIn, type ISODate } from "./dates";

/**
 * The reader's timezone, and the day they are actually in.
 *
 * The server has no way of knowing either, so the browser writes its zone into
 * a cookie on first paint and every render after that is right. Until it does
 * — a crawler, a curl, the very first request from a new device — this falls
 * back to UTC, which is what the site did everywhere before.
 *
 * The cookie is validated before it reaches `Intl`: it arrives from the client
 * and is used to format dates, so it is not trusted on the strength of having
 * a plausible name.
 */
export const TZ_COOKIE = "ninety-tz";

export async function viewerTimeZone(): Promise<string | undefined> {
  const value = (await cookies()).get(TZ_COOKIE)?.value;
  return isTimeZone(value) ? value : undefined;
}

/** What day it is for the person reading, not for the machine rendering. */
export async function viewerToday(): Promise<ISODate> {
  return todayIn(await viewerTimeZone());
}
