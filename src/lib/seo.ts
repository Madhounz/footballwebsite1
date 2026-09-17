import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getRepository } from "./data";
import { competitionName } from "./i18n/names";
import { SITE } from "./site";

/**
 * What the site covers, in one sentence, built from what it actually holds.
 *
 * This is the line search engines and chat apps print under the link. It used
 * to be a hand-typed list of five competitions; it is now assembled from
 * `listCompetitions()` every time it is printed, so it can never name a
 * competition the site does not have.
 *
 * It lives here rather than in the layout because more than one page needs it,
 * and the one that did not use it shipped `{competitions}` — the raw
 * placeholder — as its description on every dated page.
 */
const NAMED = 4;

export async function coverageLine(locale: string): Promise<string> {
  const t = await getTranslations({ locale, namespace: "meta" });
  const competitions = await (await getRepository()).listCompetitions();
  if (competitions.length === 0) return t("descriptionPlain");
  const named = competitions.slice(0, NAMED).map((c) => competitionName(c, locale));
  const rest = competitions.length - named.length;
  if (rest > 0) named.push(t("andMore", { n: rest }));
  const list = new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(named);
  return t("description", { competitions: list });
}

/**
 * Canonical and alternate links for one page.
 *
 * Both languages serve the same content at two paths — English at the bare
 * path, Arabic under `/ar` — so every page has to say which one it is and
 * where the other lives. Without that, search engines pick one themselves and
 * usually pick wrong.
 *
 * The title is left for Next to template ("… · ninety"), and the share card
 * comes from the route's own `opengraph-image`.
 */
export function pageMeta({
  locale,
  path,
  title,
  description,
}: {
  locale: string;
  /** Path without the locale prefix, e.g. `/match/arsenal-vs-chelsea-2026-09-19`. */
  path: string;
  title: string;
  description?: string;
}): Metadata {
  const en = `${SITE.url}${path}`;
  const ar = `${SITE.url}/ar${path === "/" ? "" : path}`;
  const canonical = locale === "ar" ? ar : en;
  return {
    title,
    description,
    alternates: { canonical, languages: { en, ar, "x-default": en } },
    openGraph: { url: canonical, description },
  };
}
