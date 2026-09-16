import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Stat } from "@/components/Section";
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
  const [team, stats] = await Promise.all([
    repo.getTeamById(player.teamId),
    repo.getPlayerSeasonStats(player.id),
  ]);
  if (!team) notFound();
  const squad = await repo.getSquad(team.id);
  const teammates = squad.filter((p) => p.position === player.position && p.id !== player.id);
  const positionLabel = tp(player.position);

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
          value={stats?.goals ?? 0}
          hint={stats?.penalties ? t("fromPens", { n: stats.penalties }) : t("thisSeason")}
        />
        <Stat label={t("assists")} value={stats?.assists ?? 0} hint={t("thisSeason")} />
        <Stat label={t("appearances")} value={stats?.appearances ?? 0} hint={t("allComps")} />
        <Stat
          label={t("age")}
          value={ageFromDOB(player.dateOfBirth)}
          hint={t("born", { date: formatMediumDate(player.dateOfBirth as ISODate, locale) })}
        />
      </div>

      <section className="card divide-y divide-line text-sm">
        <Row k={t("position")} v={positionLabel} />
        <Row k={t("shirt")} v={player.shirtNumber ? String(player.shirtNumber) : "—"} />
        <Row k={t("nationality")} v={player.nationality} />
        {player.heightCm && <Row k={t("height")} v={t("cm", { n: player.heightCm })} />}
        {player.preferredFoot && <Row k={t("foot")} v={t(player.preferredFoot)} />}
        <Row k={t("club")} v={teamName(team, locale)} />
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
