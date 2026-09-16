"use client";

import { useTranslations } from "next-intl";
import { toggleFollow, useFollowing } from "./useFollowing";

/**
 * Follow a club. No account, no prompt, no dialog — one tap, and the home page
 * starts leading with their matches.
 */
export function FollowButton({ teamId, name }: { teamId: string; name: string }) {
  const t = useTranslations("follow");
  const following = useFollowing();
  const on = following.includes(teamId);
  return (
    <button
      type="button"
      onClick={() => toggleFollow(teamId)}
      aria-pressed={on}
      title={on ? t("followingTitle", { name }) : t("followTitle", { name })}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        on
          ? "border-accent bg-accent-soft text-accent"
          : "border-line text-muted hover:border-line-strong hover:text-ink"
      }`}
    >
      <span aria-hidden="true">{on ? "★" : "☆"}</span>
      {on ? t("following") : t("follow")}
    </button>
  );
}
