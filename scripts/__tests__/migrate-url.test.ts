import { describe, expect, it } from "vitest";
import { migrationUrl } from "../migrate-if-db.mjs";

describe("migrationUrl", () => {
  it("prefers an explicit direct url", () => {
    expect(
      migrationUrl({
        DIRECT_DATABASE_URL: "postgres://direct/db",
        DATABASE_URL: "postgres://pooled/db",
      }),
    ).toMatchObject({ url: "postgres://direct/db", direct: true });
  });

  it("rewrites a Neon pooler host to its direct twin", () => {
    const { url, rewritten } = migrationUrl({
      DATABASE_URL:
        "postgresql://u:p@ep-cool-paper-aujb0hk5-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require",
    });
    expect(rewritten).toBe(true);
    expect(url).toContain("@ep-cool-paper-aujb0hk5.c-10.us-east-1.aws.neon.tech/");
    expect(url).not.toContain("-pooler");
    expect(url).toContain("sslmode=require");
  });

  it("leaves a direct host alone", () => {
    const db = "postgresql://u:p@db.example.com:5432/ninety";
    expect(migrationUrl({ DATABASE_URL: db })).toMatchObject({ url: db, rewritten: false });
  });

  it("reports nothing to do when no database is configured", () => {
    expect(migrationUrl({}).url).toBeUndefined();
  });
});
