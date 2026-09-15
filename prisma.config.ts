import { defineConfig } from "prisma/config";

// `prisma generate` needs no database, so fall back to a placeholder URL. Migrations
// and the sync pipeline require a real DATABASE_URL.
const url = process.env.DATABASE_URL ?? "postgresql://ninety:ninety@localhost:5432/ninety";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: { url },
});
