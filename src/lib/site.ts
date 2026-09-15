/** Site-wide constants. Owner details can be overridden per deployment through env vars. */
export const SITE = {
  name: "ninety",
  url:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_ENV === "production"
      ? "https://ninety90.vercel.app"
      : "http://localhost:3000"),
  owner: {
    name: process.env.NEXT_PUBLIC_OWNER_NAME ?? "Ahmed Almadhoun",
    url: process.env.NEXT_PUBLIC_OWNER_URL ?? "https://ahmedalmadhoun.com/",
  },
  /** Where testers send feedback. Empty hides the link. */
  feedbackUrl: process.env.NEXT_PUBLIC_FEEDBACK_URL ?? "",
};
