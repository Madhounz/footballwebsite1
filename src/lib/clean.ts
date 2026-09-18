/**
 * Provider fields are not copy.
 *
 * A data provider fills a "city" column with whatever its own source had in
 * it, and what its source had was sometimes a postal code, sometimes the
 * string "null", sometimes nothing at all. Rendered straight onto a page that
 * is otherwise carefully written, it reads as carelessness — "Lille OSC null",
 * "Club Brugge 8200", "Porto 4350-451" — and it is: the fault is ours for
 * printing it, not theirs for having it.
 *
 * So anything that came from a provider and is shown to a person goes through
 * here first, and anything that is not plainly a place becomes nothing. A
 * missing line is invisible. A wrong one is not.
 */
const NOT_A_VALUE = new Set(["null", "undefined", "none", "n/a", "na", "unknown", "-", "--", "?"]);

/** A city, a stadium, anything that should read as a name. Empty when it does not. */
export function place(value: string | null | undefined): string {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  if (NOT_A_VALUE.has(text.toLowerCase())) return "";
  // A postal code wearing a city's clothes: "8200", "4350-451", "75016".
  if (!/\p{L}/u.test(text)) return "";
  // A British postcode has letters in it and is still not a city.
  if (/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(text)) return "";
  // Mostly digits with a word attached is still an address, not a city.
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  const digits = (text.match(/\d/g) ?? []).length;
  if (digits > letters) return "";
  return text;
}

/**
 * A founding year, or nothing. Football's oldest clubs are from the 1850s, and
 * a club cannot have been founded after today — a provider zero, a 1, or a
 * year in the future is a missing value with a number in it.
 */
export function foundedYear(value: number | null | undefined, now = new Date()): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const year = Math.trunc(value);
  return year >= 1850 && year <= now.getUTCFullYear() ? year : null;
}
