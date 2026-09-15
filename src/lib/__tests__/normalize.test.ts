import { describe, expect, it } from "vitest";
import { normalizeName, resolveTeamId } from "../pipeline/normalize";

const known = [
  { id: "manchester-united", name: "Manchester United", shortName: "Man United" },
  { id: "inter", name: "Inter", shortName: "Inter" },
  { id: "bayern-munich", name: "FC Bayern München", shortName: "Bayern" },
];

describe("normalizeName", () => {
  it("strips club suffixes and diacritics", () => {
    expect(normalizeName("Manchester United FC")).toBe("manchester united");
    expect(normalizeName("FC Bayern München")).toBe("bayern munchen");
    expect(normalizeName("Atlético de Madrid")).toBe("atletico madrid");
    expect(normalizeName("Bologna FC 1909")).toBe("bologna");
  });
});

describe("resolveTeamId", () => {
  it("maps provider spellings to canonical ids", () => {
    expect(resolveTeamId("Manchester United FC", known)).toBe("manchester-united");
    expect(resolveTeamId("Man Utd", known)).toBe("manchester-united");
    expect(resolveTeamId("FC Internazionale Milano", known)).toBe("inter");
    expect(resolveTeamId("Bayern Munich", known)).toBe("bayern-munich");
  });
  it("returns null instead of guessing", () => {
    expect(resolveTeamId("Inter Miami CF", known)).toBeNull();
  });
});
