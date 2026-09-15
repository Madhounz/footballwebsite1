import { getTranslations } from "next-intl/server";

/** Translates a provider stage label ("League phase", "Last 16") when we have a translation. */
export async function StageLabel({ stage }: { stage?: string }) {
  if (!stage) return null;
  const t = await getTranslations("league.stages");
  return <>{t.has(stage) ? t(stage) : stage}</>;
}
