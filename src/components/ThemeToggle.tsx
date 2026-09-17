"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";
const KEY = "ninety:theme";
/**
 * The choice is kept in a cookie as well as in storage, because the server
 * renders it onto `<html>` and only the cookie reaches the server. Storage
 * stays because reading it is synchronous and because it is where the choice
 * of anyone who visited before this existed still lives.
 */
const COOKIE = "ninety-theme";
const listeners = new Set<() => void>();

function fromCookie(): Theme | null {
  const m = document.cookie.match(/(?:^|;\s*)ninety-theme=(light|dark|system)/);
  return m ? (m[1] as Theme) : null;
}

function read(): Theme {
  try {
    const v = fromCookie() ?? localStorage.getItem(KEY);
    return v === "dark" || v === "light" ? v : "system";
  } catch {
    return "system";
  }
}

function write(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  // A year, on every path, and not sent across sites.
  document.cookie = `${COOKIE}=${theme};path=/;max-age=31536000;samesite=lax`;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function ThemeToggle() {
  const t = useTranslations("nav");
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);

  function cycle() {
    write(theme === "system" ? "dark" : theme === "dark" ? "light" : "system");
  }

  const label = t("theme", {
    mode: t(theme === "system" ? "themeSystem" : theme === "dark" ? "themeDark" : "themeLight"),
  });
  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted hover:text-ink"
    >
      {theme === "dark" ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      ) : theme === "light" ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      )}
    </button>
  );
}
