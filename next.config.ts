import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Prisma + pg must stay on the Node runtime and must not be bundled.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  // The Arabic share cards read their font off disk at render time; nothing
  // imports the file, so tracing has to be told to deploy it.
  outputFileTracingIncludes: { "/[locale]/**": ["./src/app/og/*.ttf"] },
  // The two files in `public/` whose default cache headers are not good enough.
  async headers() {
    return [
      {
        // A worker a CDN is holding on to cannot be replaced by deploying a new
        // one — the only caching mistake here with no way back — so it is
        // revalidated every time it is asked for.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        // Unlike the build output these names carry no hash, so a year would
        // outlive the mark. A week costs nothing and still reaches people.
        source: "/icons/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
