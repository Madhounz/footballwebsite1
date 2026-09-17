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

  it("pulls a midweek competition up on the day it plays", () => {
    // ucl is 6th and nothing else is on: promoted four places it sits 2nd.
    const { shown } = competitionFocus(all, on("ucl"), 3);
    expect(shown.map((c) => c.id)).toEqual(["epl", "laliga", "ucl"]);
  });

  it("does not let a competition low on the list outrank a big one resting", () => {
    // The whole point: the Eredivisie playing on a Tuesday is 8th promoted to
    // 4th, which is still behind the Premier League, La Liga and Bundesliga.
    const { shown, rest } = competitionFocus(all, on("eredivisie"), 3);
    expect(shown.map((c) => c.id)).toEqual(["epl", "laliga", "bundesliga"]);
    expect(rest.map((c) => c.id)).toContain("eredivisie");
  });

  it("shows the one that is playing in its own place, not at the top", () => {
    // uel is what is on tonight, and it is still the last card on the rail.
    const { shown } = competitionFocus(all, on("uel"), 4);
    expect(shown.map((c) => c.id)).toEqual(["epl", "laliga", "bundesliga", "uel"]);
  });

  it("falls back to the site's order when nothing is playing", () => {
    const { shown, rest } = competitionFocus(all, [], 3);
    expect(shown.map((c) => c.id)).toEqual(["epl", "laliga", "bundesliga"]);
    expect(rest).toHaveLength(5);
  });

  it("keeps the leader when everything is playing", () => {
    const { shown } = competitionFocus(all, on(...all.map((c) => c.id)), 3);
    expect(shown.map((c) => c.id)).toEqual(["epl", "laliga", "bundesliga"]);
  });

  it("never drops a competition: shown and rest hold all of them", () => {
    for (const limit of [0, 1, 5, 8, 20]) {
      const { shown, rest } = competitionFocus(all, on("ucl"), limit);
      expect([...shown, ...rest].map((c) => c.id).sort()).toEqual(all.map((c) => c.id).sort());
      expect(shown.length).toBeLessThanOrEqual(Math.max(limit, 0) || all.length);
    }
  });
});
