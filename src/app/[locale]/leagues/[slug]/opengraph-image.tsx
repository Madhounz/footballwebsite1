import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { Card, OG, OG_CACHE, OG_CONTENT_TYPE, OG_SIZE, ogFonts, Words } from "@/app/og/card";
import { getRepository } from "@/lib/data";
import { competitionName } from "@/lib/i18n/names";
import { isRtl } from "@/i18n/routing";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Competition";

export default async function LeagueCard({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "league" });
  const repo = await getRepository();
  const competition = await repo.getCompetitionBySlug(slug);
  const fonts = await ogFonts(locale);
  if (!competition) return new ImageResponse(<Card>{""}</Card>, { ...size, fonts });
  const dir = isRtl(locale) ? "rtl" : "ltr";

  return new ImageResponse(
    <Card
      accent={competition.color}
      dir={dir}
      eyebrow={[
        <Words key="country" dir={dir}>
          {competition.country}
        </Words>,
      ]}
      footer={[t("tabTable"), t("tabFixtures"), t("tabResults"), t("tabHistory")].map((x, i) => (
        <Words key={i} dir={dir}>
          {x}
        </Words>
      ))}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 120,
            height: 8,
            borderRadius: 4,
            marginBottom: 32,
            background: competition.color,
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: 88,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: dir === "rtl" ? 0 : "-0.03em",
            maxWidth: 950,
          }}
        >
          <Words dir={dir}>{competitionName(competition, locale)}</Words>
        </div>
        <div style={{ display: "flex", marginTop: 26, fontSize: 40, color: OG.muted }}>
          {competition.season}
        </div>
      </div>
    </Card>,
    { ...size, fonts, headers: { "cache-control": OG_CACHE.stable } },
  );
}
