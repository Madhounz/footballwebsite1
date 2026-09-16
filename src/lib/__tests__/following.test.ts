import { describe, expect, it } from "vitest";
import { FOLLOW_LIMIT, parseFollowing, serialiseFollowing, toggleFollowing } from "../following";

describe("parseFollowing", () => {
  it("reads a stored list", () => {
    expect(parseFollowing('["arsenal","real-madrid"]')).toEqual(["arsenal", "real-madrid"]);
  });

  it("treats anything it cannot trust as nobody followed", () => {
    // Storage is shared with the rest of the web and survives our deploys, so
    // a page must never break on what it finds there.
    for (const raw of [null, "", "not json", "{}", '"arsenal"', "[1,2,3]", '[""]']) {
      expect(parseFollowing(raw)).toEqual([]);
    }
  });

  it("drops duplicates and anything past the limit", () => {
    const many = JSON.stringify([
      "arsenal",
      "arsenal",
      ...Array.from({ length: FOLLOW_LIMIT + 5 }, (_, i) => `club-${i}`),
    ]);
    const parsed = parseFollowing(many);
    expect(parsed.length).toBe(FOLLOW_LIMIT);
    expect(new Set(parsed).size).toBe(parsed.length);
  });
});

describe("toggleFollowing", () => {
  it("adds a club at the end and removes it again", () => {
    const one = toggleFollowing([], "arsenal");
    expect(one).toEqual(["arsenal"]);
    expect(toggleFollowing(one, "arsenal")).toEqual([]);
  });

  it("keeps the order clubs were added in", () => {
    const list = ["arsenal", "chelsea", "spurs"];
    expect(toggleFollowing(list, "chelsea")).toEqual(["arsenal", "spurs"]);
    expect(toggleFollowing(list, "leeds")).toEqual([...list, "leeds"]);
  });

  it("forgets the oldest club rather than growing without end", () => {
    const full = Array.from({ length: FOLLOW_LIMIT }, (_, i) => `club-${i}`);
    const next = toggleFollowing(full, "arsenal");
    expect(next.length).toBe(FOLLOW_LIMIT);
    expect(next.at(-1)).toBe("arsenal");
    expect(next).not.toContain("club-0");
  });
});

describe("serialiseFollowing", () => {
  it("round-trips through parse", () => {
    const ids = ["arsenal", "milan"];
    expect(parseFollowing(serialiseFollowing(ids))).toEqual(ids);
  });
});
