import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { DayPage } from "@/components/DayPage";
import { formatLongDate, isISODate, todayISO } from "@/lib/dates";

type Params = Promise<{ locale: string; date: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, date } = await params;
  if (!isISODate(date)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("matchesOn", { date: formatLongDate(date, locale) }) };
}

export default async function MatchesByDate({ params }: { params: Params }) {
  const { locale, date } = await params;
  if (!isISODate(date)) notFound();
  if (date === todayISO()) redirect({ href: "/", locale });
  return <DayPage date={date} />;
}
