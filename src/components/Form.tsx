import type { FormResult } from "@/lib/types";

/** Last-five results, oldest first, left to right in every locale (a timeline, not text). */
export function FormBadges({ form, size = "sm" }: { form: FormResult[]; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-4 w-4 text-[9px]" : "h-6 w-6 text-[11px]";
  return (
    <span className="inline-flex gap-0.5" dir="ltr" aria-label={`Form: ${form.join(" ")}`}>
      {form.map((r, i) => (
        <span
          key={i}
          className={`inline-flex items-center justify-center rounded-[4px] font-semibold text-white ${dim} ${
            r === "W" ? "bg-win" : r === "D" ? "bg-draw" : "bg-loss"
          }`}
        >
          {r}
        </span>
      ))}
    </span>
  );
}
