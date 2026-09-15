/** Site-wide constants. Owner details can be overridden per deployment through env vars. */
export const SITE = {
  name: "ninety",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  owner: {
    name: process.env.NEXT_PUBLIC_OWNER_NAME ?? "Madhounz",
    url: process.env.NEXT_PUBLIC_OWNER_URL ?? "https://github.com/Madhounz",
  },
  /** Where testers send feedback. Empty hides the link. */
  feedbackUrl: process.env.NEXT_PUBLIC_FEEDBACK_URL ?? "",
};
