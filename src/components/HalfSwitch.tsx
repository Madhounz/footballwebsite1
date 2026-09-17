import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Half } from "@/lib/data/halves";

/** Which half the table below is of. Same shape as the home/away switch. */
export async function HalfSwitch({ slug, half }: { slug: string; half: Half }) {
  const t = await getTranslations("league");
  const options: { value: Half; label: string }[] = [
    { value: "second", label: t("halfSecond") },
    { value: "first", label: t("halfFirst") },
  ];
  return (
    <div className="inline-flex rounded-full border border-line p-0.5 text-xs">
      {options.map((o) => {
        const active = o.value === half;
        return (
          <Link
            key={o.value}
            href={
              o.value === "second"
                ? `/leagues/${slug}/halves`
                : `/leagues/${slug}/halves?half=first`
            }
            aria-current={active ? "true" : undefined}
            className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
              active ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
