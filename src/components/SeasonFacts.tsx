import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TeamCrest } from "@/components/TeamCrest";
import { teamShortName } from "@/lib/i18n/names";
import type { SeasonFacts as Facts } from "@/lib/data/season-facts";
import type { MatchView, Team } from "@/lib/types";

/**
 * The season read off the results. Every number here comes from scorelines,
 * which we hold for every match, so unlike the scorer chart it needs no caveat.
 */
export async function SeasonFacts({ facts, teams }: { facts: Facts; teams: Map<string, Team> }) {
  const t = await getTranslations("league");
  const locale = await getLocale();
  if (facts.played === 0) return null;
  const { homeWins, draws, awayWins } = facts.outcomes;
  const pct = (n: number) => Math.round((n / facts.played) * 100);

  return (
    <div className="card divide-y divide-line">
      <Row label={t("goalsPerMatch")}>
        <span className="tnum font-medium">{facts.goalsPerMatch}</span>
      </Row>
      <Row label={t("outcomes")}>
        <span className="flex items-center gap-2">
          <Bar parts={[pct(homeWins), pct(draws), pct(awayWins)]} />
          <span className="tnum text-xs text-muted" dir="ltr">
            {pct(homeWins)}/{pct(draws)}/{pct(awayWins)}
          </span>
        </span>
      </Row>
      {facts.bestAttack && (
        <Row label={t("bestAttack")}>
          <TeamValue
            team={teams.get(facts.bestAttack.teamId)}
            value={facts.bestAttack.goals}
            locale={locale}
          />
        </Row>
      )}
      {facts.bestDefence && (
        <Row label={t("bestDefence")}>
          <TeamValue
            team={teams.get(facts.bestDefence.teamId)}
            value={facts.bestDefence.conceded}
            locale={locale}
          />
        </Row>
      )}
      {facts.cleanSheets[0] && (
        <Row label={t("cleanSheets")}>
          <TeamValue
            team={teams.get(facts.cleanSheets[0].teamId)}
            value={facts.cleanSheets[0].count}
            locale={locale}
          />
        </Row>
      )}
      {facts.biggestWin && (
        <Row label={t("biggestWin")}>
          <MatchValue view={facts.biggestWin} locale={locale} />
        </Row>
      )}
      {facts.highestScoring && (
        <Row label={t("highestScoring")}>
          <MatchValue view={facts.highestScoring} locale={locale} />
        </Row>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </div>
  );
}

function TeamValue({
  team,
  value,
  locale,
}: {
  team: Team | undefined;
  value: number;
  locale: string;
}) {
  if (!team) return <span className="tnum font-medium">{value}</span>;
  return (
    <Link
      href={`/teams/${team.slug}`}
      className="flex min-w-0 items-center gap-2 font-medium hover:underline"
    >
      <TeamCrest team={team} size={18} />
      <span className="truncate">{teamShortName(team, locale)}</span>
      <span className="tnum text-muted">{value}</span>
    </Link>
  );
}

function MatchValue({ view, locale }: { view: MatchView; locale: string }) {
  const { match: m, home, away } = view;
  return (
    <Link
      href={`/match/${m.slug}`}
      className="flex min-w-0 items-center gap-2 font-medium hover:underline"
    >
      <span className="truncate">
        {teamShortName(home, locale)}{" "}
        <span className="tnum" dir="ltr">
          {m.score?.home}–{m.score?.away}
        </span>{" "}
        {teamShortName(away, locale)}
      </span>
    </Link>
  );
}

/** Home wins, draws, away wins as one bar: the shape of a league at a glance. */
function Bar({ parts }: { parts: [number, number, number] | number[] }) {
  const [h, d, a] = parts;
  return (
    <span className="flex h-2 w-24 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
      <span className="bg-win" style={{ width: `${h}%` }} />
      <span className="bg-draw" style={{ width: `${d}%` }} />
      <span className="bg-loss" style={{ width: `${a}%` }} />
    </span>
  );
}
