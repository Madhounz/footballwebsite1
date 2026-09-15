import { describe, expect, it } from "vitest";
import { matchSlug } from "../match-slug";
import { DemoRepository } from "../data/demo";

describe("matchSlug", () => {
  it("reads as a shareable url with no characters a router can mishandle", () => {
    const slug = matchSlug({
      homeTeamId: "arsenal",
      awayTeamId: "chelsea",
      kickoff: "2026-09-19T14:00:00.000Z",
    });
    expect(slug).toBe("arsenal-vs-chelsea-2026-09-19");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(encodeURIComponent(slug)).toBe(slug);
  });
});

describe("DemoRepository match lookup", () => {
  const repo = new DemoRepository(() => new Date("2026-11-03T18:30:00Z"));

  it("resolves a match by its slug and by its raw id", async () => {
    const [view] = await repo.getMatchesOnDate("2026-11-03");
    expect(view.match.slug).toContain("-vs-");
    const bySlug = await repo.getMatch(view.match.slug);
    const byId = await repo.getMatch(view.match.id);
    expect(bySlug?.view.match.id).toBe(view.match.id);
    expect(byId?.view.match.id).toBe(view.match.id);
  });

  it("gives every match on a day a distinct slug", async () => {
    const views = await repo.getMatchesOnDate("2026-11-03");
    const slugs = views.map((v) => v.match.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
