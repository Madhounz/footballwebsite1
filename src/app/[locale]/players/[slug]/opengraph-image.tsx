import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import {
  Card,
  Crest,
  loadCrest,
  OG,
  OG_CACHE,
  OG_CONTENT_TYPE,
  OG_SIZE,
  ogFonts,
  Words,
} from "@/app/og/card";
import { getRepository } from "@/lib/data";
import { teamName } from "@/lib/i18n/names";
import { isRtl } from "@/i18n/routing";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Player";

export default async function PlayerCard({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "player" });
  const tp = await getTranslations({ locale, namespace: "positions" });
  const repo = await getRepository();
  const player = await repo.getPlayerBySlug(slug);
  const fonts = await ogFonts(locale);
  if (!player) return new ImageResponse(<Card>{""}</Card>, { ...size, fonts });
  const [team, stats] = await Promise.all([
    repo.getTeamById(player.teamId),
    repo.getPlayerSeasonStats(player.id),
  ]);
  // A share card that says "0 goals" about a player we hold nothing for is
  // the loudest possible way to be wrong, since it travels into group chats.
  const known = stats !== null && stats.source !== "none";
  const crest = await loadCrest(team?.crestUrl);
  const dir = isRtl(locale) ? "rtl" : "ltr";

  return new ImageResponse(
    <Card
      accent={team?.colors[0] ?? OG.accent}
      dir={dir}
      eyebrow={[
        team ? (
          <>
            <div
              style={{
                display: "flex",
                marginLeft: dir === "rtl" ? 12 : 0,
                marginRight: dir === "rtl" ? 0 : 12,
              }}
            >
              <Crest team={team} src={crest} size={36} />
            </div>
            <Words dir={dir}>{teamName(team, locale)}</Words>
          </>
        ) : (
          ""
        ),
      ]}
      footer={[
        <Words key="position" dir={dir}>
          {tp(player.position)}
        </Words>,
        <Words key="nationality" dir={dir}>
          {player.nationality}
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 190,
            height: 190,
            borderRadius: 40,
            background: team?.colors[0] ?? OG.surface,
            color: "#fff",
            fontSize: 84,
            fontWeight: 700,
          }}
        >
          {player.shirtNumber || "–"}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxWidth: 680,
            marginLeft: dir === "rtl" ? 0 : 48,
            marginRight: dir === "rtl" ? 48 : 0,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: dir === "rtl" ? 0 : "-0.03em",
            }}
          >
            {player.name}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: dir === "rtl" ? "row-reverse" : "row",
              marginTop: 26,
            }}
          >
            <Figure n={known ? stats.goals : "—"} label={t("goals")} />
            <Figure n={known ? stats.assists : "—"} label={t("assists")} />
            <Figure n={known ? stats.appearances : "—"} label={t("appearances")} />
          </div>
        </div>
      </div>
    </Card>,
    { ...size, fonts, headers: { "cache-control": OG_CACHE.stable } },
  );
}

function Figure({ n, label }: { n: ReactNode; label: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginRight: 44,
      }}
    >
      <div style={{ display: "flex", fontSize: 56, fontWeight: 700 }}>{n}</div>
      <div style={{ display: "flex", marginTop: 4, fontSize: 24, color: OG.muted }}>{label}</div>
    </div>
  );
}
