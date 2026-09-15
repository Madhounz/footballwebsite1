import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Stat } from "@/components/Section";
import { TeamCrest } from "@/components/TeamCrest";
import { getRepository } from "@/lib/data";
import { ageFromDOB, formatMediumDate, type ISODate } from "@/lib/dates";
import { positionLabel } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const repo = await getRepository();
  const p = await repo.getPlayerBySlug((await params).slug);
  return p ? { title: p.name } : {};
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
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
          {player.shirtNumber}
        </span>
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-faint">
            {positionLabel(player.position)} · {player.nationality}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{player.name}</h1>
          <Link
            href={`/teams/${team.slug}`}
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"
          >
            <TeamCrest team={team} size={18} /> {team.name}
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Goals"
          value={stats?.goals ?? 0}
          hint={stats?.penalties ? `${stats.penalties} from penalties` : "this season"}
        />
        <Stat label="Assists" value={stats?.assists ?? 0} hint="this season" />
        <Stat label="Appearances" value={stats?.appearances ?? 0} hint="all competitions" />
        <Stat
          label="Age"
          value={ageFromDOB(player.dateOfBirth)}
          hint={`Born ${formatMediumDate(player.dateOfBirth as ISODate)}`}
        />
      </div>

      <section className="card divide-y divide-line text-sm">
        <Row k="Position" v={positionLabel(player.position)} />
        <Row k="Shirt number" v={String(player.shirtNumber)} />
        <Row k="Nationality" v={player.nationality} />
        {player.heightCm && <Row k="Height" v={`${player.heightCm} cm`} />}
        {player.preferredFoot && (
          <Row
            k="Preferred foot"
            v={player.preferredFoot[0].toUpperCase() + player.preferredFoot.slice(1)}
          />
        )}
        <Row k="Club" v={team.name} />
      </section>

      {teammates.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">
            Other {positionLabel(player.position).toLowerCase()}s at {team.shortName}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {teammates.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/players/${p.slug}`}
                  className="card row-hover tnum inline-flex items-center gap-2 px-3 py-1.5 text-sm"
                >
                  <span className="text-faint">{p.shirtNumber}</span> {p.name}
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
