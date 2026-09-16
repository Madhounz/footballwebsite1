import { ImageResponse } from "next/og";
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
import { dateOf, formatKickoffUTC, formatMediumDate } from "@/lib/dates";
import { competitionName, teamShortName } from "@/lib/i18n/names";
import { isRtl } from "@/i18n/routing";
import type { Team } from "@/lib/types";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Match";

/** Crests, score and status: what a shared link should say before anyone taps it. */
export default async function MatchCard({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "match" });
  const repo = await getRepository();
  const detail = await repo.getMatch(id);
  const fonts = await ogFonts(locale);
  if (!detail) {
    return new ImageResponse(<Card>{""}</Card>, { ...size, fonts });
  }
  const { match: m, home, away, competition } = detail.view;
  const dir = isRtl(locale) ? "rtl" : "ltr";
  const [homeCrest, awayCrest] = await Promise.all([
    loadCrest(home.crestUrl),
    loadCrest(away.crestUrl),
  ]);
  const live = m.status === "live";
  const status = live
    ? m.phase === "HT"
      ? t("ht")
      : m.minute != null
        ? `${m.minute}'`
        : t("liveWord")
    : m.status === "finished"
      ? t("ft")
      : m.status === "postponed"
        ? t("postponed")
        : m.status === "cancelled"
          ? t("cancelled")
          : "";

  return new ImageResponse(
    <Card
      accent={competition.color}
      dir={dir}
      eyebrow={[
        <div
          key="competition"
          style={{
            display: "flex",
            flexDirection: dir === "rtl" ? "row-reverse" : "row",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              width: 18,
              height: 18,
              borderRadius: 9,
              marginLeft: dir === "rtl" ? 12 : 0,
              marginRight: dir === "rtl" ? 0 : 12,
              background: competition.color,
            }}
          />
          <Words dir={dir}>{competitionName(competition, locale)}</Words>
        </div>,
        <Words key="round" dir={dir}>
          {m.stage ?? t("matchday", { n: m.round })}
        </Words>,
      ]}
      footer={[
        <Words key="date" dir={dir}>
          {formatMediumDate(dateOf(m.kickoff), locale)}
        </Words>,
        m.venue ?? "",
      ]}
    >
      <div
        style={{
          display: "flex",
          flexDirection: dir === "rtl" ? "row-reverse" : "row",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <Side team={home} crest={homeCrest} locale={locale} dir={dir} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "0 20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: m.score ? 132 : 92,
              fontWeight: 700,
              letterSpacing: "-0.04em",
            }}
          >
            {m.score ? (
              <>
                <div style={{ display: "flex" }}>{m.score.home}</div>
                <div style={{ display: "flex", margin: "0 24px", color: OG.faint }}>–</div>
                <div style={{ display: "flex" }}>{m.score.away}</div>
              </>
            ) : (
              <div style={{ display: "flex" }}>{formatKickoffUTC(m.kickoff)}</div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexDirection: dir === "rtl" ? "row-reverse" : "row",
              marginTop: 14,
              fontSize: 28,
              fontWeight: 700,
              color: live ? OG.live : OG.muted,
            }}
          >
            {live && (
              <div
                style={{
                  display: "flex",
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  marginLeft: dir === "rtl" ? 10 : 0,
                  marginRight: dir === "rtl" ? 0 : 10,
                  background: OG.live,
                }}
              />
            )}
            <Words dir={dir}>{status}</Words>
          </div>
        </div>
        <Side team={away} crest={awayCrest} locale={locale} dir={dir} />
      </div>
    </Card>,
    {
      ...size,
      fonts,
      headers: { "cache-control": live ? OG_CACHE.live : OG_CACHE.stable },
    },
  );
}

function Side({
  team,
  crest,
  locale,
  dir,
}: {
  team: Team;
  crest: string | null;
  locale: string;
  dir: "ltr" | "rtl";
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: 340,
      }}
    >
      <Crest team={team} src={crest} size={160} />
      <div
        style={{
          display: "flex",
          marginTop: 26,
          fontSize: 40,
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.1,
        }}
      >
        <Words dir={dir}>{teamShortName(team, locale)}</Words>
      </div>
    </div>
  );
}
