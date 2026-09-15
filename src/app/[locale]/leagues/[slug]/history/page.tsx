import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Empty, Section } from "@/components/Section";
import { TeamCrest } from "@/components/TeamCrest";
import { getRepository } from "@/lib/data";
import { teamName } from "@/lib/i18n/names";

export default async function HistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getTranslations("league");
  const locale = await getLocale();
  const repo = await getRepository();
  const c = await repo.getCompetitionBySlug((await params).slug);
  if (!c) notFound();
  const [honours, teams] = await Promise.all([repo.getHonours(c.id), repo.listTeams()]);
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  if (!honours) return <Empty>{t("noHistory")}</Empty>;
  const note = (honours as { note?: string }).note;
  const nameOf = (teamId: string | undefined, fallback: string) => {
    const team = teamId ? teamMap.get(teamId) : undefined;
    return team ? teamName(team, locale) : fallback;
  };
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <Section
        title={t("pastWinners")}
        action={<span>{t("seasons", { n: honours.entries.length })}</span>}
      >
        <div className="card overflow-hidden">
          <table className="tnum w-full text-sm">
            <thead>
              <tr className="border-b border-line text-start text-[11px] uppercase tracking-wide text-faint">
                <th className="w-24 py-2.5 ps-4 text-start font-medium">{t("th.season")}</th>
                <th className="py-2.5 text-start font-medium">{t("th.winner")}</th>
                <th className="hidden py-2.5 text-start font-medium sm:table-cell">
                  {t("th.runnerUp")}
                </th>
                <th className="hidden py-2.5 pe-4 text-start font-medium md:table-cell">
                  {t("th.note")}
                </th>
              </tr>
            </thead>
            <tbody>
              {honours.entries.map((e) => {
                const w = e.winnerTeamId ? teamMap.get(e.winnerTeamId) : undefined;
                const r = e.runnerUpTeamId ? teamMap.get(e.runnerUpTeamId) : undefined;
                return (
                  <tr key={e.season} className="row-hover border-b border-line last:border-0">
                    <td className="py-2 ps-4 text-muted" dir="ltr">
                      {e.season}
                    </td>
                    <td className="py-2 font-medium">
                      {w ? (
                        <Link
                          href={`/teams/${w.slug}`}
                          className="inline-flex items-center gap-2 hover:underline"
                        >
                          <TeamCrest team={w} size={20} /> {nameOf(e.winnerTeamId, e.winner)}
                        </Link>
                      ) : (
                        e.winner
                      )}
                    </td>
                    <td className="hidden py-2 text-muted sm:table-cell">
                      {r ? (
                        <Link href={`/teams/${r.slug}`} className="hover:underline">
                          {nameOf(e.runnerUpTeamId, e.runnerUp ?? "")}
                        </Link>
                      ) : (
                        (e.runnerUp ?? "—")
                      )}
                    </td>
                    <td className="hidden py-2 pe-4 text-xs text-muted md:table-cell" dir="ltr">
                      {e.detail ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {typeof note === "string" && (
            <div className="border-t border-line px-4 py-2 text-xs text-faint">{note}</div>
          )}
        </div>
      </Section>
      <Section title={t("mostTitles")}>
        <div className="card overflow-hidden">
          <ol className="tnum divide-y divide-line text-sm">
            {honours.mostTitles.map((m, i) => {
              const team = m.teamId ? teamMap.get(m.teamId) : undefined;
              return (
                <li key={m.team} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-4 text-faint">{i + 1}</span>
                  {team ? (
                    <TeamCrest team={team} size={20} />
                  ) : (
                    <span className="inline-block h-5 w-5 rounded-full bg-surface-2" />
                  )}
                  <span className="flex-1 truncate">
                    {team ? (
                      <Link href={`/teams/${team.slug}`} className="hover:underline">
                        {teamName(team, locale)}
                      </Link>
                    ) : (
                      m.team
                    )}
                  </span>
                  <span className="font-semibold">{m.count}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </Section>
    </div>
  );
}
