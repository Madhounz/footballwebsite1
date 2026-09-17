"use client";

import { useTranslations } from "next-intl";

const KEY = "ninety:theme";
const COOKIE = "ninety-theme";

/** What the reader is looking at right now, whoever decided it. */
function shown(): "light" | "dark" {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * One tap, one flip.
 *
 * This used to cycle system → dark → light. On a device set to dark that made
 * the first tap do nothing at all — the page was already dark, and "system"
 * and "dark" look identical until the device changes its mind. A button whose
 * first press appears broken is a broken button, so it now simply turns the
 * page into the opposite of what is on screen.
 *
 * "Follow the device" is not lost, it is inferred: choosing the side the device
 * is already on stores "system" rather than pinning it, so a reader who flips
 * to light and back to dark on a dark phone is quietly following the device
 * again — and their theme will change with it at sunrise.
 */
export function ThemeToggle() {
  const t = useTranslations("nav");

  function flip() {
    const next = shown() === "dark" ? "light" : "dark";
    const system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    // Landing back on the device's own setting means following it again.
    const store = next === system ? "system" : next;
    const root = document.documentElement;
    if (store === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", store);
    try {
      localStorage.setItem(KEY, store);
    } catch {}
    document.cookie = `${COOKIE}=${store};path=/;max-age=31536000;samesite=lax`;
  }

  return (
    <button
      type="button"
      onClick={flip}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors hover:text-ink"
    >
      {/* Shown on a light page: tapping goes dark. */}
      <span className="theme-to-dark inline-flex items-center justify-center">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
        <span className="sr-only">{t("toDark")}</span>
      </span>
      {/* Shown on a dark page: tapping goes light. */}
      <span className="theme-to-light items-center justify-center">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        <span className="sr-only">{t("toLight")}</span>
      </span>
    </button>
  );
}
