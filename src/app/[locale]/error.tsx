"use client";

import { useTranslations } from "next-intl";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t("errorTitle")}</h1>
      <p className="text-sm text-muted">
        {error.digest ? t("reference", { id: error.digest }) : error.message}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-on-ink"
      >
        {t("tryAgain")}
      </button>
    </div>
  );
}
