import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getRepository } from "@/lib/data";
import { clubsInForm } from "@/lib/data/match-context";
import { todayISO, type ISODate } from "@/lib/dates";
import { competitionName, teamShortName } from "@/lib/i18n/names";
import { isLive } from "@/lib/live-status";
import { AutoRefresh } from "./AutoRefresh";
import { DateStrip } from "./DateStrip";
import { FollowedTeams } from "./FollowedTeams";
import { InForm } from "./InForm";
import { MatchList } from "./MatchList";
import { ScoringRaces, type Race } from "./ScoringRaces";
import { TeamCrest } from "./TeamCrest";

/** Shared body for `/` and `/matches/[date]`. */
export async function DayPage({ date }: { date: ISODate }) {
  const t = await getTranslations("home");
  const locale = await getLocale();
  const repo = await getRepository();
  const today = todayISO();
  const [views, competitions] = await Promise.all([
    repo.getMatchesOnDate(date),
    repo.listCompetitions(),
  ]);
  const live = views.filter((v) => isLive(v.match)).length;
  const isToday = date === today;
  const allTeams = await repo.listTeams();
  // The followed list lives on the device, so the names it will need have to
  // travel with the page: the browser knows the ids, not how to say them.
  const teamNames = Object.fromEntries(
    allTeams.map((team) => [team.id, teamShortName(team, locale)]),
  );

  // Who is scoring, everywhere. Reads the chart the refresh already stores, so
  // it costs nothing, and unlike a day's fixtures it is never empty.
  const [races, playerList] = await Promise.all([
    Promise.all(
      competitions.map(async (c): Promise<Race> => ({
        competition: c,
        rows: (await repo.getTopScorers(c.id, 3)).rows,
      })),
    ),
    repo.listPlayers(),
  ]);
  const players = new Map(playerList.map((p) => [p.id, p]));
  const teamsById = new Map(allTeams.map((team) => [team.id, team]));

  const snapshots = await Promise.all(
    competitions.map(async (c) => {
      const s = await repo.getStandings(c.id);
      const top = s.rows.slice(0, 3);
      const teams = new Map((await repo.listTeams(c.id)).map((team) => [team.id, team]));
      return { competition: c, top, rows: s.rows, teams };
    }),
  );
  // Clubs on a run, from the last five each standings row already carries — so
  // the whole section is free, and says the thing a table cannot: who is
  // climbing, rather than who is top.
  const inForm = clubsInForm(
    snapshots.map(({ competition, rows }) => ({ competitionId: competition.id, rows })),
  );
  const competitionsById = new Map(competitions.map((c) => [c.id, c]));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <AutoRefresh enabled={isToday && live > 0} seconds={30} />
      <div className="min-w-0 space-y-5">
        <DateStrip date={date} today={today} />
        {isToday && <FollowedTeams names={teamNames} />}
        {live > 0 && (
          <p className="flex items-center gap-2 text-sm text-live">
            <span className="live-dot" /> {t("inPlay", { count: live })}
          </p>
        )}
        <MatchList
          views={views}
          competitions={competitions}
          emptyText={isToday ? t("emptyToday") : t("emptyDay")}
        />
        <ScoringRaces races={races} players={players} teams={teamsById} />
        <InForm entries={inForm} teams={teamsById} competitions={competitionsById} />
      </div>
      <aside className="min-w-0 space-y-4 lg:pt-[52px]">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          {t("atTheTop")}
        </h2>
        {snapshots.map(({ competition, top, teams }) => (
          <div key={competition.id} className="card overflow-hidden">
            <Link
              href={`/leagues/${competition.slug}`}
              className="flex items-center justify-between px-4 py-2.5 text-sm font-semibold hover:bg-surface-2"
            >
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: competition.color }}
                  aria-hidden="true"
                />
                {competitionName(competition, locale)}
              </span>
              <span className="text-faint">{locale === "ar" ? "←" : "→"}</span>
            </Link>
            <ol className="tnum divide-y divide-line border-t border-line text-sm">
              {top.map((r) => {
                const team = teams.get(r.teamId)!;
                return (
                  <li key={r.teamId}>
                    <Link
                      href={`/teams/${team.slug}`}
                      className="row-hover flex items-center gap-2 px-4 py-1.5"
                    >
                      <span className="w-4 text-faint">{r.position}</span>
                      <TeamCrest team={team} size={18} />
                      <span className="flex-1 truncate">{teamShortName(team, locale)}</span>
                      <span className="font-semibold">{r.points}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </aside>
    </div>
  );
}
