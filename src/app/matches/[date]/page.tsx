import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DayPage } from "@/components/DayPage";
import { formatLongDate, isISODate, todayISO } from "@/lib/dates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  if (!isISODate(date)) return {};
  return { title: `Matches on ${formatLongDate(date)}` };
}

export default async function MatchesByDate({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isISODate(date)) notFound();
  if (date === todayISO()) redirect("/");
  return <DayPage date={date} />;
}
