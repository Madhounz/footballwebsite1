import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { Card, OG, OG_CACHE, OG_CONTENT_TYPE, OG_SIZE, ogFonts, Words } from "@/app/og/card";
import { getRepository } from "@/lib/data";
import { isRtl } from "@/i18n/routing";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "ninety";

/** The card every page without one of its own falls back to. */
export default async function SiteCard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const repo = await getRepository();
  const competitions = await repo.listCompetitions();
  const dir = isRtl(locale) ? "rtl" : "ltr";
  // The title carries the promise after the dash: "ninety — the full 90, all in one place".
  const [name, tagline] = t("title").split("—");

  return new ImageResponse(
    <Card dir={dir} eyebrow={[competitions[0]?.season ?? ""]}>
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
            alignItems: "baseline",
            fontSize: 132,
            fontWeight: 700,
            letterSpacing: dir === "rtl" ? 0 : "-0.05em",
          }}
        >
          <Words dir={dir}>{name}</Words>
          <div style={{ display: "flex", color: OG.accent }}>.</div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 40,
            color: OG.muted,
            maxWidth: 900,
          }}
        >
          <Words dir={dir}>{tagline ?? t("description")}</Words>
        </div>
        {/* What is covered, as colours rather than a row of names no card can fit. */}
        <div style={{ display: "flex", marginTop: 44 }}>
          {competitions.map((c, i) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                width: 22,
                height: 22,
                borderRadius: 11,
                marginRight: i < competitions.length - 1 ? 16 : 0,
                background: c.color,
              }}
            />
          ))}
        </div>
      </div>
    </Card>,
    { ...size, fonts: await ogFonts(locale), headers: { "cache-control": OG_CACHE.stable } },
  );
}
