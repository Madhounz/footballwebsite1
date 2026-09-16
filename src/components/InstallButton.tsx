"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * "Add to home screen", offered once and never again once answered.
 *
 * The browser decides whether installing is possible at all — it fires the
 * event only when the site qualifies and the person has not already installed
 * it — so this is absent far more often than it is present, which is the right
 * amount of nagging for a scores site.
 */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED = "ninety:install-dismissed";

export function InstallButton() {
  const t = useTranslations("install");
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // Keep it for our own button rather than the browser's bar.
      try {
        if (localStorage.getItem(DISMISSED)) return;
      } catch {
        // No storage: offer it anyway.
      }
      setPrompt(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!prompt) return null;

  const remember = () => {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {}
  };

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={async () => {
          await prompt.prompt();
          await prompt.userChoice;
          remember();
          setPrompt(null);
        }}
        className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent"
      >
        {t("add")}
      </button>
      <button
        type="button"
        onClick={() => {
          remember();
          setPrompt(null);
        }}
        aria-label={t("dismiss")}
        title={t("dismiss")}
        className="px-1 text-xs text-faint hover:text-ink"
      >
        ✕
      </button>
    </span>
  );
}
