import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Mark } from "@/components/Logo";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <Mark size={40} className="text-faint" />
      <h1 className="text-2xl font-semibold tracking-tight">{t("notFoundTitle")}</h1>
      <p className="text-muted">{t("notFoundText")}</p>
      <Link href="/" className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-on-ink">
        {t("todaysMatches")}
      </Link>
    </div>
  );
}
