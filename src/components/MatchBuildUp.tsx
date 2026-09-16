import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TeamCrest } from "@/components/TeamCrest";
import { per, type MatchContext, type TeamContext, type Streak } from "@/lib/data/match-context";
import { barColors } from "@/lib/colors";
import { teamShortName } from "@/lib/i18n/names";
import type { FormResult, MatchView, Team } from "@/lib/types";

/**
 * How the two clubs arrive, built from scorelines alone.
 *
 * This is the part of a match page that is always there. Line-ups and the
 * timeline come from a metered plan that cannot reach every match; a league
 * position, a form guide and a head-to-head come from results we hold for the
 * whole season, so they are available before kick-off, during, after, and for
 * a match played two years ago.
 *
 * Every bar is drawn against the larger of the two values, so the club ahead
 * on a measure fills its side and the other is read as a fraction of it — a
 * comparison the eye makes before it reads a single number.
 */

/** Bars are drawn relative to whichever club leads the measure. */
function share(value: number, other: number): string {
  const top = Math.max(value, other);
  if (top <= 0) return "0%";
  return `${Math.round((value / top) * 100)}%`;
}

function Bar({
  value,
  other,
  color,
  align,
  delay,
}: {
  value: number;
  other: number;
  color: string;
  align: "start" | "end";
  delay: number;
}) {
  return (
    <div className={`flex min-w-0 flex-1 ${align === "end" ? "justify-end" : "justify-start"}`}>
      <div
        className="tape-fill h-2 rounded-full"
        style={
          {
            "--w": share(value, other),
            background: color,
            animationDelay: `${delay}ms`,
          } as React.CSSProperties
        }
      />
    </div>
  );
}

function TapeRow({
  label,
  home,
  away,
  homeColor,
  awayColor,
  delay,
  lowerIsBetter = false,
}: {
  label: string;
  home: number;
  away: number;
  homeColor: string;
  awayColor: string;
  delay: number;
  lowerIsBetter?: boolean;
}) {
  const homeAhead = lowerIsBetter ? home < away : home > away;
  const awayAhead = lowerIsBetter ? away < home : away > home;
  return (
    <div
      className="rise grid grid-cols-[2.25rem_1fr_6rem_1fr_2.25rem] items-center gap-2 py-1.5 sm:grid-cols-[3rem_1fr_9rem_1fr_3rem]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span
        className={`tnum text-end text-sm ${homeAhead ? "font-semibold" : "text-muted"}`}
        dir="ltr"
      >
        {home}
      </span>
      <Bar value={home} other={away} color={homeColor} align="end" delay={delay} />
      <span className="text-balance px-1 text-center text-[10px] uppercase leading-tight tracking-wide text-faint sm:text-[11px]">
        {label}
      </span>
      <Bar value={away} other={home} color={awayColor} align="start" delay={delay} />
      <span className={`tnum text-sm ${awayAhead ? "font-semibold" : "text-muted"}`} dir="ltr">
        {away}
      </span>
    </div>
  );
}

const FORM_CLASS: Record<FormResult, string> = {
  W: "bg-[var(--win)] text-white",
  D: "bg-[var(--draw)] text-white",
  L: "bg-[var(--loss)] text-white",
};

function FormPills({
  form,
  align,
  labels,
}: {
  form: { result: FormResult; view: MatchView }[];
  align: "start" | "end";
  labels: Record<FormResult, string>;
}) {
  if (form.length === 0) return null;
  return (
    // Two layers on purpose: the outer one is aligned by the page's direction,
    // so the pills sit against the card's outer edge in Arabic as in English,
    // while the inner one is pinned left-to-right so the five results keep
    // reading oldest to newest rather than reversing with the page.
    <div className={`flex ${align === "end" ? "justify-end" : "justify-start"}`}>
      <div className="flex gap-1" dir="ltr">
        {[...form].reverse().map(({ result, view }, i) => (
          <Link
            key={view.match.id}
            href={`/match/${view.match.slug}`}
            title={`${view.home.shortName} ${view.match.score?.home}–${view.match.score?.away} ${view.away.shortName}`}
            aria-label={`${labels[result]}: ${view.home.shortName} ${view.match.score?.home}–${view.match.score?.away} ${view.away.shortName}`}
            className={`rise flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold transition-transform hover:scale-110 ${FORM_CLASS[result]}`}
            style={{ animationDelay: `${120 + i * 55}ms` }}
          >
            {result}
          </Link>
        ))}
      </div>
    </div>
  );
}

function streakLabel(
  streak: Streak,
  t: (k: string, v?: Record<string, unknown>) => string,
): string {
  const key =
    streak.kind === "unbeaten"
      ? "streakUnbeaten"
      : streak.kind === "winless"
        ? "streakWinless"
        : streak.kind === "W"
          ? "streakWins"
          : streak.kind === "D"
            ? "streakDraws"
            : "streakLosses";
  return t(key, { n: streak.count });
}

async function SideHeader({
  team,
  ctx,
  align,
  locale,
}: {
  team: Team;
  ctx: TeamContext;
  align: "start" | "end";
  locale: string;
}) {
  const t = await getTranslations("match");
  const end = align === "end";
  const labels = { W: t("resultW"), D: t("resultD"), L: t("resultL") } as Record<
    FormResult,
    string
  >;
  return (
    <div className={`min-w-0 space-y-2 ${end ? "text-end" : "text-start"}`}>
      <div className={`flex items-center gap-2 ${end ? "justify-end" : ""}`}>
        {!end && <TeamCrest team={team} size={28} />}
        <Link
          href={`/teams/${team.slug}`}
          className="truncate text-sm font-semibold hover:text-accent"
        >
          {teamShortName(team, locale)}
        </Link>
        {end && <TeamCrest team={team} size={28} />}
      </div>
      {ctx.row && (
        <div className="text-xs text-muted">
          <span className="tnum font-medium text-ink">
            {t("position", { n: ctx.row.position })}
          </span>
          <span className="mx-1.5 text-faint">·</span>
          <span className="tnum">{t("points", { n: ctx.row.points })}</span>
        </div>
      )}
      <FormPills form={ctx.form} align={align} labels={labels} />
      {ctx.streak && (
        <div className="text-[11px] text-faint">{streakLabel(ctx.streak, t as never)}</div>
      )}
    </div>
  );
}

/** Past meetings as one bar: this fixture's home club, draws, then the away club. */
function H2HBar({
  h2h,
  homeColor,
  awayColor,
}: {
  h2h: MatchContext["h2h"];
  homeColor: string;
  awayColor: string;
}) {
  const total = h2h.played || 1;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2" dir="ltr">
      <div
        className="tape-fill"
        style={{ "--w": pct(h2h.homeWins), background: homeColor } as React.CSSProperties}
      />
      <div
        className="tape-fill"
        style={
          {
            "--w": pct(h2h.draws),
            background: "var(--draw)",
            animationDelay: "90ms",
          } as React.CSSProperties
        }
      />
      <div
        className="tape-fill"
        style={
          {
            "--w": pct(h2h.awayWins),
            background: awayColor,
            animationDelay: "180ms",
          } as React.CSSProperties
        }
      />
    </div>
  );
}

export async function MatchBuildUp({
  context,
  home,
  away,
  locale,
}: {
  context: MatchContext;
  home: Team;
  away: Team;
  locale: string;
}) {
  const t = await getTranslations("match");
  if (!context.hasAnything) return null;
  const { home: homeColor, away: awayColor } = barColors(home, away);
  const h = context.home;
  const a = context.away;

  const record = (r: TeamContext["side"]) => `${r.won}–${r.drawn}–${r.lost}`;

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-2 gap-4 p-4 sm:p-5">
        <SideHeader team={home} ctx={h} align="start" locale={locale} />
        <SideHeader team={away} ctx={a} align="end" locale={locale} />
      </div>

      {/* The side of the season each club is playing here, which a whole-season
          record hides: a club can be excellent and still poor away from home. */}
      {(h.side.played > 0 || a.side.played > 0) && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-line px-4 py-2 text-xs sm:px-5">
          <span className="tnum text-end text-muted" dir="ltr">
            {record(h.side)}
          </span>
          <span className="px-2 text-center text-[11px] uppercase tracking-wide text-faint">
            {t("hereRecord")}
          </span>
          <span className="tnum text-muted" dir="ltr">
            {record(a.side)}
          </span>
        </div>
      )}

      <div className="border-t border-line px-3 py-3 sm:px-5 sm:py-4">
        <div className="mx-auto w-full max-w-2xl">
          <TapeRow
            label={t("goalsPerMatch")}
            home={per(h.overall.goalsFor, h.overall.played)}
            away={per(a.overall.goalsFor, a.overall.played)}
            homeColor={homeColor}
            awayColor={awayColor}
            delay={0}
          />
          <TapeRow
            label={t("concededPerMatch")}
            home={per(h.overall.goalsAgainst, h.overall.played)}
            away={per(a.overall.goalsAgainst, a.overall.played)}
            homeColor={homeColor}
            awayColor={awayColor}
            delay={90}
            lowerIsBetter
          />
          <TapeRow
            label={t("cleanSheets")}
            home={h.overall.cleanSheets}
            away={a.overall.cleanSheets}
            homeColor={homeColor}
            awayColor={awayColor}
            delay={180}
          />
          <TapeRow
            label={t("wins")}
            home={h.overall.won}
            away={a.overall.won}
            homeColor={homeColor}
            awayColor={awayColor}
            delay={270}
          />
        </div>
      </div>

      {context.h2h.played > 0 && (
        <div className="space-y-2 border-t border-line px-4 py-4 sm:px-5">
          <div className="flex items-baseline justify-between gap-3 text-[11px] uppercase tracking-wide text-faint">
            <span>{t("h2h")}</span>
            <span className="tnum normal-case">{t("meetings", { n: context.h2h.played })}</span>
          </div>
          <H2HBar h2h={context.h2h} homeColor={homeColor} awayColor={awayColor} />
          <div className="flex justify-between gap-3 text-xs text-muted">
            <span className="tnum">{t("winsN", { n: context.h2h.homeWins })}</span>
            <span className="tnum">{t("drawnN", { n: context.h2h.draws })}</span>
            <span className="tnum">{t("winsN", { n: context.h2h.awayWins })}</span>
          </div>
        </div>
      )}
    </div>
  );
}
