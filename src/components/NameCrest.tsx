/**
 * A badge for a club we hold nothing but the name of.
 *
 * Past winners reach back further than the squads do: Leicester won a league
 * we cover, Sheffield Wednesday sit tenth on its all-time list, and neither is
 * a club in the database today. They were drawn as a blank circle or as no
 * circle at all, which left the winners column stepping in and out of line
 * every few rows.
 *
 * So it is a monogram rather than a colour: we do not know the club's colours,
 * and inventing them would be inventing a fact. It stays deliberately quieter
 * than a real crest — this club has no page to go to.
 */
export function NameCrest({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-faint"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(7, Math.round(size * 0.36)),
        letterSpacing: "-0.02em",
        boxShadow: "inset 0 0 0 1px var(--line)",
      }}
      aria-hidden="true"
    >
      {monogram(name)}
    </span>
  );
}

/**
 * Initials of up to three words, or the first three letters of a single word:
 * "Sheffield Wednesday" → SW, "Juventus" → JUV. Word initials rather than the
 * first three letters throughout, because those turn "Nottingham Forest" into
 * NOT.
 */
export function monogram(name: string): string {
  const words = name
    // An apostrophe joins a word rather than breaking it: "Nott'm Forest" is
    // two words, not three, and NMF is nobody.
    .replace(/['\u2019]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
