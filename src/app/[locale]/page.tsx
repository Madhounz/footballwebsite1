import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DayPage } from "@/components/DayPage";
import { matchesOnDate } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { isLive, liveCountTitle } from "@/lib/live-status";
import { coverageLine } from "@/lib/seo";

/**
 * How many matches are in play, in the browser tab.
 *
 * A scores site gets left open in a background tab, where about fifteen
 * characters and a favicon are all anybody sees — so those characters may as
 * well carry the news. The count sits in front of the title the way an inbox
 * carries its unread count, and because the page already refreshes itself
 * while something is live, it keeps up on its own.
 *
 * It belongs in the metadata rather than in a client component setting
 * `document.title`: React owns the `<title>` element it rendered and puts its
 * own text back after hydration, so an imperative write is undone a moment
 * later. This is the same title going through the same renderer.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const live = (await matchesOnDate(todayISO())).filter((v) => isLive(v.match)).length;
  return {
    title: { absolute: liveCountTitle(live, t("title")) },
    description: await coverageLine(locale),
  };
}

export default async function HomePage() {
  return <DayPage date={todayISO()} />;
}
