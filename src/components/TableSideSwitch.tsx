import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { TableSide } from "@/lib/types";

/**
 * Overall, home or away. Plain links rather than a client component: the choice
 * belongs in the URL so a home table can be shared, and the page is already
 * rendered on the server.
 */
export async function TableSideSwitch({ slug, side }: { slug: string; side: TableSide }) {
  const t = await getTranslations("league");
  const options: { value: TableSide; label: string }[] = [
    { value: "all", label: t("sideAll") },
    { value: "home", label: t("sideHome") },
    { value: "away", label: t("sideAway") },
  ];
  return (
    <div className="inline-flex rounded-full border border-line p-0.5 text-xs">
      {options.map((o) => {
        const active = o.value === side;
        return (
          <Link
            key={o.value}
            href={o.value === "all" ? `/leagues/${slug}` : `/leagues/${slug}?table=${o.value}`}
            aria-current={active ? "true" : undefined}
            className={`rounded-full inline-flex min-h-9 items-center px-2.5 sm:min-h-0 sm:py-1 font-medium transition-colors ${
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
