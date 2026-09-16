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
};

export default withNextIntl(nextConfig);
