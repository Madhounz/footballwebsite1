import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Pick } from "@/lib/data/worth-watching";
import { ordinal } from "@/lib/format";
import { teamShortName } from "@/lib/i18n/names";
import { isRtl } from "@/i18n/routing";
import { LocalTime } from "./LocalTime";
import { TeamCrest } from "./TeamCrest";

/**
 * The two or three fixtures worth an evening, and why.
 *
 * The list beside it is in kick-off order, which is no help at all in deciding
 * what to watch. This is the same day read the other way round — by what is at
 * stake — and it prints its reasoning, because a recommendation that will not
 * say why it is recommending something is an advertisement.
 */
export async function WorthWatching({ picks }: { picks: Pick[] }) {
  const t = await getTranslations("home");
  const tm = await getTranslations("match");
  const locale = await getLocale();
  if (picks.length === 0) return null;
  // Arabic takes plain numbers; English wants 2nd and 4th.
  const place = (n: number) => (isRtl(locale) ? String(n) : ordinal(n));

  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-faint">
        {t("worthWatching")}
      </h2>
      <div className="card divide-y divide-line overflow-hidden">
        {picks.map(({ view, reason }, i) => {
          const { match: m, home, away, competition } = view;
          return (
            <Link
              key={m.id}
              href={`/match/${m.slug}`}
              className="rise row-hover flex items-center gap-2.5 px-3 py-2.5"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span
                className="h-8 w-[3px] shrink-0 rounded-full"
                style={{ backgroundColor: competition.color }}
                aria-hidden="true"
              />
              <span className="flex shrink-0 items-center gap-1">
                <TeamCrest team={home} size={20} />
                <TeamCrest team={away} size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-sm font-medium">
                  {teamShortName(home, locale)}{" "}
                  <span className="font-normal text-faint">{tm("vs")}</span>{" "}
                  {teamShortName(away, locale)}
                </span>
                <span className="truncate text-[11px] text-muted">
                  {reason.kind === "derby"
                    ? t("reasonDerby", { city: reason.city })
                    : reason.kind === "form"
                      ? t("reasonForm", { n: reason.n })
                      : t("reasonTop", {
                          home: place(reason.home),
                          away: place(reason.away),
                        })}
                </span>
              </span>
              <LocalTime iso={m.kickoff} className="shrink-0 text-[11px] tnum text-faint" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
