import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { DataSourceInfo } from "@/lib/types";
import { SITE } from "@/lib/site";
import { Mark } from "./Logo";

export async function SiteFooter({ info }: { info: DataSourceInfo }) {
  const t = await getTranslations("footer");
  const demo = info.kind === "demo";
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-muted sm:px-6 md:grid-cols-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-ink">
            <Mark size={20} />
            <span className="font-semibold tracking-tight">ninety</span>
          </div>
          <p className="max-w-xs leading-relaxed">{t("tagline")}</p>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-faint">
            {t("data")}
          </div>
          <p className="leading-relaxed">
            <span className="text-ink">{demo ? t("sourceDemo") : t("sourceLive")}</span>{" "}
            {demo ? t("sourceDemoText") : t("sourceLiveText")}
          </p>
          <Link href="/about#data" className="inline-block text-accent hover:underline">
            {t("howRight")}
          </Link>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-faint">
            {t("shortcuts")}
          </div>
          <ul className="space-y-1">
            <li>
              <kbd className="rounded border border-line bg-surface px-1 font-mono text-[11px]">
                ⌘K
              </kbd>{" "}
              {t("search")}
            </li>
            <li>
              <kbd className="rounded border border-line bg-surface px-1 font-mono text-[11px]">
                /
              </kbd>{" "}
              {t("search")}
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-faint sm:px-6">
          <span>{t("copyright", { year: new Date().getUTCFullYear() })}</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              {t("builtBy")}{" "}
              <a href={SITE.owner.url} className="text-muted hover:text-ink" rel="noopener">
                {SITE.owner.name}
              </a>
            </span>
            {SITE.feedbackUrl && (
              <a href={SITE.feedbackUrl} className="text-accent hover:underline" rel="noopener">
                {t("feedback")}
              </a>
            )}
            <span>{t("localTime")}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
