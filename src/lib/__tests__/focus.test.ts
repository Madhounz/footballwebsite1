import { describe, expect, it } from "vitest";
import { competitionFocus } from "../data/focus";
import type { Competition, MatchView } from "../types";

const comp = (id: string, order: number): Competition =>
  ({
    id,
    slug: id,
    name: id,
    shortName: id,
    country: "",
    countryCode: "",
    kind: "league",
    order,
    teamCount: 20,
    rounds: 38,
    color: "#000",
    zones: [],
    season: "2026/27",
  }) as unknown as Competition;

const all = ["epl", "laliga", "bundesliga", "seriea", "ligue1", "ucl", "uel", "eredivisie"].map(
  (id, i) => comp(id, i + 1),
);
const on = (...ids: string[]) =>
  ids.map((id) => ({ competition: { id } }) as unknown as Pick<MatchView, "competition">);

describe("competitionFocus", () => {
  it("leaves a short list alone", () => {
    const { shown, rest } = competitionFocus(all.slice(0, 4), on("seriea"), 6);
    expect(shown.map((c) => c.id)).toEqual(["epl", "laliga", "bundesliga", "seriea"]);
    expect(rest).toEqual([]);
  });

  it("takes the competitions playing that day first", () => {
    const { shown, rest } = competitionFocus(all, on("uel", "eredivisie"), 3);
    expect(shown.map((c) => c.id)).toEqual(["epl", "uel", "eredivisie"]);
    expect(rest.map((c) => c.id)).toEqual(["laliga", "bundesliga", "seriea", "ligue1", "ucl"]);
  });

  it("fills the remaining room in the site's own order", () => {
    const { shown } = competitionFocus(all, on("uel"), 4);
    expect(shown.map((c) => c.id)).toEqual(["epl", "laliga", "bundesliga", "uel"]);
  });

  it("shows what it picked in order, not in order of relevance", () => {
    const { shown } = competitionFocus(all, on("eredivisie", "seriea"), 3);
    expect(shown.map((c) => c.id)).toEqual(["epl", "seriea", "eredivisie"]);
  });

  it("falls back to the site's order when nothing is playing", () => {
    const { shown, rest } = competitionFocus(all, [], 3);
    expect(shown.map((c) => c.id)).toEqual(["epl", "laliga", "bundesliga"]);
    expect(rest).toHaveLength(5);
  });

  it("never drops a competition: shown and rest hold all of them", () => {
    for (const limit of [0, 1, 5, 8, 20]) {
      const { shown, rest } = competitionFocus(all, on("ucl"), limit);
      expect([...shown, ...rest].map((c) => c.id).sort()).toEqual(all.map((c) => c.id).sort());
      expect(shown.length).toBeLessThanOrEqual(Math.max(limit, 0) || all.length);
    }
  });
});
