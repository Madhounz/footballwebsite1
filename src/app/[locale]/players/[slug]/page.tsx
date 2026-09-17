import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Empty, Stat } from "@/components/Section";
import { PlayerMatches } from "@/components/PlayerMatches";
import { TeamCrest } from "@/components/TeamCrest";
import { getRepository } from "@/lib/data";
import { pageMeta } from "@/lib/seo";
import { ageFromDOB, formatMediumDate, type ISODate } from "@/lib/dates";
import { teamName, teamShortName } from "@/lib/i18n/names";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const repo = await getRepository();
  const { locale, slug } = await params;
  const p = await repo.getPlayerBySlug(slug);
  if (!p) return {};
  const team = await repo.getTeamById(p.teamId);
  const t = await getTranslations({ locale, namespace: "player" });
  const tp = await getTranslations({ locale, namespace: "positions" });
  return pageMeta({
    locale,
    path: `/players/${p.slug}`,
    title: p.name,
    description: t("metaDescription", {
      name: p.name,
      position: tp(p.position),
      team: team ? teamName(team, locale) : "",
    }),
  });
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getTranslations("player");
  const tp = await getTranslations("positions");
  const locale = await getLocale();
  const repo = await getRepository();
  const player = await repo.getPlayerBySlug((await params).slug);
  if (!player) notFound();
  const [team, stats, appearances, anyLineups] = await Promise.all([
    repo.getTeamById(player.teamId),
    repo.getPlayerSeasonStats(player.id),
    repo.getPlayerMatches(player.id),
    repo.holdsLineups(),
  ]);
  if (!team) notFound();
  const squad = await repo.getSquad(team.id);
  const teammates = squad.filter((p) => p.position === player.position && p.id !== player.id);
  const positionLabel = tp(player.position);
  // Season totals come from the appearances themselves: one source, no drift.
  const minutes = appearances.reduce((n, a) => n + a.minutes, 0);
  const starts = appearances.filter((a) => a.started).length;
  const yellow = appearances.reduce((n, a) => n + a.yellow, 0);
  const red = appearances.filter((a) => a.red).length;
  const goals = stats?.goals ?? 0;
  // Goals per 90, once there is enough football behind it to mean anything.
  const per90 = minutes >= 180 ? Math.round((goals / minutes) * 90 * 100) / 100 : null;
  // Whether we hold anything about this player's season at all. Without the
  // second provider we hold no line-ups and no events, and only the players in
  // a competition's scorer chart have numbers — for everyone else the honest
  // answer is a dash, because nought is a claim we cannot make.
  const known = stats !== null && stats.source !== "none";
  const apps = appearances.length || (known ? stats.appearances : 0);
  const dash = "—";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center gap-4">
        <span
          className="tnum inline-flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-semibold"
          style={{
            background: team.colors[0],
            color: "#fff",
            boxShadow: "inset 0 0 0 1px rgb(0 0 0 / .15)",
          }}
        >
          {player.shirtNumber || "–"}
        </span>
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-faint">
            {positionLabel} · {player.nationality}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{player.name}</h1>
          <Link
            href={`/teams/${team.slug}`}
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"
          >
            <TeamCrest team={team} size={18} /> {teamName(team, locale)}
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={t("goals")}
          value={known ? goals : dash}
          hint={
            stats?.penalties
              ? t("fromPens", { n: stats.penalties })
              : per90 != null
                ? t("perNinety", { n: per90 })
                : t("thisSeason")
          }
        />
        <Stat label={t("assists")} value={known ? stats.assists : dash} hint={t("thisSeason")} />
        <Stat
          label={t("appearances")}
          value={apps || (known ? 0 : dash)}
          hint={appearances.length ? t("starts", { n: starts }) : t("allComps")}
        />
        <Stat
          label={t("minutes")}
          value={minutes || dash}
          hint={minutes ? t("thisSeason") : t("fromLineups")}
        />
      </div>
      {/* Say which of the two the reader is looking at, exactly as the scorer
          chart on a league page does. A number with no provenance is the thing
          this site is trying not to be. */}
      {stats?.source === "provider" ? (
        <p className="-mt-6 text-xs text-faint">{t("statsProvider")}</p>
      ) : stats?.source === "none" ? (
        <p className="-mt-6 text-xs text-faint">{t("statsNone")}</p>
      ) : (
        repo.info().kind === "db" && <p className="-mt-6 text-xs text-faint">{t("statsCounted")}</p>
      )}

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("matches")}</h2>
        {appearances.length ? (
          <PlayerMatches entries={appearances} teamId={team.id} />
        ) : (
          // "No appearances yet" is a claim about the player. Where the site
          // holds no line-up at all it is a claim about us, and a wrong one
          // about him — he has been playing every week.
          <Empty>{anyLineups ? t("noMatches") : t("matchesNoSource")}</Empty>
        )}
      </section>

      <section className="card divide-y divide-line text-sm">
        <Row k={t("position")} v={positionLabel} />
        <Row
          k={t("age")}
          v={`${ageFromDOB(player.dateOfBirth)} · ${t("born", { date: formatMediumDate(player.dateOfBirth as ISODate, locale) })}`}
        />
        <Row k={t("shirt")} v={player.shirtNumber ? String(player.shirtNumber) : "—"} />
        <Row k={t("nationality")} v={player.nationality} />
        {player.heightCm && <Row k={t("height")} v={t("cm", { n: player.heightCm })} />}
        {player.preferredFoot && <Row k={t("foot")} v={t(player.preferredFoot)} />}
        <Row k={t("club")} v={teamName(team, locale)} />
        {(yellow > 0 || red > 0) && <Row k={t("cards")} v={t("cardsCount", { yellow, red })} />}
      </section>

      {teammates.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">
            {t("others", {
              position: positionLabel.toLowerCase(),
              team: teamShortName(team, locale),
            })}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {teammates.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/players/${p.slug}`}
                  className="card row-hover tnum inline-flex items-center gap-2 px-3 py-1.5 text-sm"
                >
                  <span className="text-faint">{p.shirtNumber || ""}</span> {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-muted">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
