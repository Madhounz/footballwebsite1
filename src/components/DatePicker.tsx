"use client";

import { useRouter } from "next/navigation";
import { todayISO, type ISODate } from "@/lib/dates";

export function DatePicker({ value }: { value: ISODate }) {
  const router = useRouter();
  return (
    <label className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm text-muted hover:text-ink">
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18" />
      </svg>
      <span className="sr-only">Pick a date</span>
      <input
        type="date"
        value={value}
        onChange={(e) => {
          const v = e.target.value as ISODate;
          if (!v) return;
          router.push(v === todayISO() ? "/" : `/matches/${v}`);
        }}
        className="bg-transparent text-ink outline-none [color-scheme:inherit]"
      />
    </label>
  );
}
