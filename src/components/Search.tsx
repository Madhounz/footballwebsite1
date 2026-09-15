"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import type { SearchItem } from "@/lib/types";

/**
 * Command-palette style search. Fed a static index (competitions + teams) at
 * render time, so it is instant and works offline. Cmd/Ctrl+K to open.
 */
export function Search({ items }: { items: SearchItem[] }) {
  const t = useTranslations("search");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const router = useRouter();

  function openPalette() {
    setQ("");
    setCursor(0);
    setOpen(true);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) setOpen(false);
        else openPalette();
      }
      if (e.key === "Escape") setOpen(false);
      if (e.key === "/" && !open && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        openPalette();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items.filter((i) => i.type === "competition");
    const score = (item: SearchItem) => {
      const hay = [item.label, item.sublabel, ...item.keywords].map((s) => s.toLowerCase());
      if (hay.some((h) => h === needle)) return 3;
      if (hay.some((h) => h.startsWith(needle))) return 2;
      if (hay.some((h) => h.includes(needle))) return 1;
      return 0;
    };
    return items
      .map((item) => ({ item, s: score(item) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || (a.item.type === "competition" ? -1 : 1))
      .slice(0, 12)
      .map((x) => x.item);
  }, [q, items]);

  function go(item: SearchItem) {
    setOpen(false);
    router.push(item.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm text-muted hover:text-ink"
        aria-label={t("aria")}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="hidden sm:inline">{t("button")}</span>
        <kbd className="hidden rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-faint md:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t("button")}
        >
          <div
            className="card w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setCursor(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCursor((c) => Math.min(c + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCursor((c) => Math.max(c - 1, 0));
                } else if (e.key === "Enter" && results[cursor]) {
                  go(results[cursor]);
                }
              }}
              placeholder={t("placeholder")}
              className="w-full border-b border-line bg-transparent px-4 py-3.5 text-base outline-none placeholder:text-faint"
            />
            <ul className="max-h-[50vh] overflow-y-auto py-1">
              {results.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-muted">
                  {t("noMatch", { query: q })}
                </li>
              )}
              {results.map((item, i) => (
                <li key={`${item.type}-${item.id}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(item)}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-start text-sm ${i === cursor ? "bg-surface-2" : ""}`}
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-xs text-muted">{item.sublabel}</span>
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-faint">
                      {t(item.type)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] text-faint">
              <span>{t("hintMove")}</span>
              <span>{t("hintClose")}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
