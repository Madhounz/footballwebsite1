import type { ISODate } from "../dates";

/**
 * Making sense of a match URL that is no longer the shape we write.
 *
 * A match link is the most shared thing on the site: it goes into group chats,
 * it gets indexed, people bookmark it. The slug it was published under is a
 * promise, and a promise that 404s two releases later is the worst kind of
 * broken link — the page still exists, we simply stopped recognising its name.
 *
 * So the canonical slug can keep changing shape, and anything that came before
 * is read here and redirected to it permanently. The parser is deliberately
 * forgiving: two clubs and, if the URL carried one, a date. It does not care
 * whether they were joined by "-vs-", whether the club ids have since grown a
 * suffix ("rayo" became "rayo-vallecano"), or which order they were in.
 *
 * It is pure so it can be tested against every shape we have ever shipped.
 */
export interface MatchRef {
  a: string;
  b: string;
  date?: ISODate;
}

const DATE_TAIL = /-(\d{4}-\d{2}-\d{2})$/;

/** One side of a URL, back to a club we hold. */
export function resolveSide(token: string, teamIds: readonly string[]): string | null {
  if (!token) return null;
  if (teamIds.includes(token)) return token;
  // A club whose id has since gained or lost a word: "rayo" ↔ "rayo-vallecano".
  const overlap = teamIds.filter((id) => id.startsWith(`${token}-`) || token.startsWith(`${id}-`));
  if (overlap.length === 1) return overlap[0];
  // ...or lost its first word: "vallecano" → "rayo-vallecano".
  const tail = teamIds.filter((id) => id.endsWith(`-${token}`));
  if (tail.length === 1) return tail[0];
  // Ambiguity is not a redirect. Two clubs it could be is no club at all.
  return null;
}

export function parseMatchRef(param: string, teamIds: readonly string[]): MatchRef | null {
  const raw = decodeURIComponent(param)
    .toLowerCase()
    .replace(/^-+|-+$/g, "");
  if (!raw) return null;

  // An internal id, which is `competition:date:home:away`.
  if (raw.includes(":")) {
    const parts = raw.split(":");
    if (parts.length === 4) {
      const a = resolveSide(parts[2], teamIds);
      const b = resolveSide(parts[3], teamIds);
      if (a && b) return { a, b, date: parts[1] as ISODate };
    }
    return null;
  }

  const dated = raw.match(DATE_TAIL);
  const date = dated ? (dated[1] as ISODate) : undefined;
  const body = dated ? raw.slice(0, dated.index) : raw;

  const joined = body.split("-vs-");
  if (joined.length === 2) {
    const a = resolveSide(joined[0], teamIds);
    const b = resolveSide(joined[1], teamIds);
    if (a && b) return { a, b, date };
  }

  // No separator we recognise: try every way of cutting the string in two and
  // take the first that names two clubs we hold. Longest first, so a club
  // whose id contains a dash is not split down the middle.
  const words = body.split("-");
  for (let cut = words.length - 1; cut >= 1; cut--) {
    const a = resolveSide(words.slice(0, cut).join("-"), teamIds);
    const b = resolveSide(words.slice(cut).join("-"), teamIds);
    if (a && b && a !== b) return { a, b, date };
  }
  return null;
}
