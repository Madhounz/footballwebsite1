import { defineRouting } from "next-intl/routing";

/** English lives at the root, Arabic under /ar. */
export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

export function isRtl(locale: string): boolean {
  return locale === "ar";
}
