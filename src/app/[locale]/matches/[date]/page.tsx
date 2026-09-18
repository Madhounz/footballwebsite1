import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { DayPage } from "@/components/DayPage";
import { coverageLine, pageMeta } from "@/lib/seo";
import { formatLongDate, isISODate } from "@/lib/dates";
import { viewerToday } from "@/lib/viewer";

type Params = Promise<{ locale: string; date: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, date } = await params;
  if (!isISODate(date)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMeta({
    locale,
    path: `/matches/${date}`,
    title: t("matchesOn", { date: formatLongDate(date, locale) }),
    description: await coverageLine(locale),
  });
}

export default async function MatchesByDate({ params }: { params: Params }) {
  const { locale, date } = await params;
  if (!isISODate(date)) notFound();
  if (date === (await viewerToday())) redirect({ href: "/", locale });
  return <DayPage date={date} />;
}
