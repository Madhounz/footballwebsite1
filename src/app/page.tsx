import { DayPage } from "@/components/DayPage";
import { todayISO } from "@/lib/dates";

export default async function HomePage() {
  return <DayPage date={todayISO()} />;
}
