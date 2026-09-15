"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

/** One-tap switch between English and Arabic, keeping the current page. */
export function LocaleSwitch() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const other = locale === "ar" ? "en" : "ar";
  return (
    <Link
      href={pathname}
      locale={other}
      aria-label={t("switchToLabel")}
      className="inline-flex h-9 items-center rounded-full border border-line bg-surface px-3 text-sm font-medium text-muted hover:text-ink"
    >
      {t("switchTo")}
    </Link>
  );
}
