import { getTranslations } from "next-intl/server";
import type { Why } from "@/lib/data/why";

/**
 * What is riding on a match nobody has played yet.
 *
 * Three lines at the top of a fixture, each of them a fact: where a result
 * would put a club, how far apart they are, what has happened the last few
 * times they met. No preview, no prediction, nobody's opinion — and nothing at
 * all rather than a line that could be written about any match in the world.
 *
 * Designed to be read in a second and then ignored: a quiet rule down the
 * side, one line each, the number that matters set in the text rather than
 * pulled out into a badge.
 */
export async function WhyItMatters({
  why,
  home,
  away,
}: {
  why: Why[];
  home: string;
  away: string;
}) {
  const t = await getTranslations("why");
  if (why.length === 0) return null;
  const name = (side: "home" | "away") => (side === "home" ? home : away);

  return (
    <section className="why" aria-label={t("title")}>
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-faint">{t("title")}</h2>
      <ul className="mt-2 space-y-1.5">
        {why.map((line, i) => (
          <li key={i} className="text-[15px] leading-snug text-ink">
            {line.kind === "climb" &&
              t("climb", {
                team: name(line.team),
                result: t(line.outcome === "home" ? "aHomeWin" : "anAwayWin"),
                to: line.to,
              })}
            {line.kind === "hold" && t("hold", { team: name(line.team), at: line.at })}
            {line.kind === "gap" &&
              t("gap", {
                low: name(line.team),
                high: name(line.team === "home" ? "away" : "home"),
                places: line.places,
              })}
            {line.kind === "h2hRun" &&
              t("h2hRun", {
                team: name(line.team),
                other: name(line.team === "home" ? "away" : "home"),
                n: line.played,
              })}
            {line.kind === "streak" &&
              t(line.won ? "streakWon" : "streakUnbeaten", {
                team: name(line.team),
                n: line.count,
              })}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-faint">{t("caveat")}</p>
    </section>
  );
}
