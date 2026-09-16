import type { Metadata } from "next";
import { SITE } from "./site";

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
