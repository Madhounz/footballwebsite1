/**
 * The site's name, in the language it is being read in.
 *
 * One place, because it appears in three: the wordmark in the header, the
 * footer, and the share card. The card is a picture of the site's identity, so
 * an Arabic reader sharing an Arabic page should not get a card in Latin.
 *
 * The `<title>` keeps "ninety" in both languages — it is what somebody types
 * into a search box — but nothing anybody looks at does.
 */
export function brandName(locale: string): string {
  return locale === "ar" ? "تسعون" : "ninety";
}
