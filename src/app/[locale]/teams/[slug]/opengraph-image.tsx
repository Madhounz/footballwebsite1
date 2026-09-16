import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import {
  Card,
  Crest,
  loadCrest,
  OG_CACHE,
  OG_CONTENT_TYPE,
  OG_SIZE,
  ogFonts,
  Words,
} from "@/app/og/card";
import { getRepository } from "@/lib/data";
import { competitionName, teamName } from "@/lib/i18n/names";
import { isRtl } from "@/i18n/routing";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Team";

export default async function TeamCard({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "team" });
  const repo = await getRepository();
  const team = await repo.getTeamBySlug(slug);
  const fonts = await ogFonts(locale);
  if (!team) {
    return new ImageResponse(<Card>{""}</Card>, { ...size, fonts });
  }
  const [crest, competitions] = await Promise.all([
    loadCrest(team.crestUrl),
    repo.listCompetitions(),
  ]);
  const league = competitions.find((c) => c.id === team.leagueId);
  const dir = isRtl(locale) ? "rtl" : "ltr";

  return new ImageResponse(
    <Card
      accent={league?.color ?? team.colors[0]}
      dir={dir}
      eyebrow={[
        <Words key="league" dir={dir}>
          {league ? competitionName(league, locale) : t("notTracked")}
        </Words>,
      ]}
      footer={[
        <Words key="city" dir={dir}>
          {team.city}
        </Words>,
        team.founded ? (
          <Words key="founded" dir={dir}>
            {t("est", { year: team.founded })}
          </Words>
        ) : (
          ""
        ),
        <Words key="stadium" dir={dir}>
          {team.stadium ?? ""}
        </Words>,
      ]}
    >
      <div
        style={{
          display: "flex",
          flexDirection: dir === "rtl" ? "row-reverse" : "row",
          alignItems: "center",
        }}
      >
        <Crest team={team} src={crest} size={220} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: dir === "rtl" ? "flex-end" : "flex-start",
            maxWidth: 640,
            marginLeft: dir === "rtl" ? 0 : 56,
            marginRight: dir === "rtl" ? 56 : 0,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: dir === "rtl" ? 0 : "-0.03em",
            }}
          >
            <Words dir={dir}>{teamName(team, locale)}</Words>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: dir === "rtl" ? "row-reverse" : "row",
              marginTop: 20,
            }}
          >
            {team.colors.slice(0, 2).map((c) => (
              <div
                key={c}
                style={{
                  display: "flex",
                  width: 56,
                  height: 10,
                  borderRadius: 5,
                  marginLeft: dir === "rtl" ? 12 : 0,
                  marginRight: dir === "rtl" ? 0 : 12,
                  background: c,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>,
    { ...size, fonts, headers: { "cache-control": OG_CACHE.stable } },
  );
}
