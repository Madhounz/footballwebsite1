import { describe, expect, it } from "vitest";
import { parseMatchRef, resolveSide } from "../data/match-lookup";

const teams = [
  "rayo-vallecano",
  "espanyol",
  "real-betis",
  "getafe",
  "real-madrid",
  "real-sociedad",
  "arsenal",
  "chelsea",
  "manchester-united",
  "brighton",
];

describe("resolveSide", () => {
  it("takes an id as it is", () => {
    expect(resolveSide("arsenal", teams)).toBe("arsenal");
  });

  it("follows an id that has since grown a word", () => {
    expect(resolveSide("rayo", teams)).toBe("rayo-vallecano");
    expect(resolveSide("vallecano", teams)).toBe("rayo-vallecano");
  });

  it("refuses when it could be two clubs", () => {
    // "real" is Madrid, Sociedad and Betis. A guess here sends somebody to the
    // wrong match, which is worse than a 404.
    expect(resolveSide("real", teams)).toBeNull();
    expect(resolveSide("", teams)).toBeNull();
    expect(resolveSide("nobody", teams)).toBeNull();
  });
});

describe("parseMatchRef", () => {
  it("reads the slug we write today", () => {
    expect(parseMatchRef("real-betis-vs-getafe-2026-09-17", teams)).toEqual({
      a: "real-betis",
      b: "getafe",
      date: "2026-09-17",
    });
  });

  it("reads a slug with no separator", () => {
    expect(parseMatchRef("rayo-vallecano-espanyol-2026-09-14", teams)).toEqual({
      a: "rayo-vallecano",
      b: "espanyol",
      date: "2026-09-14",
    });
  });

  it("reads short club ids from an older release", () => {
    expect(parseMatchRef("rayo-espanyol-2026-09-14", teams)).toEqual({
      a: "rayo-vallecano",
      b: "espanyol",
      date: "2026-09-14",
    });
  });

  it("reads one with no date at all", () => {
    expect(parseMatchRef("arsenal-vs-chelsea", teams)).toEqual({
      a: "arsenal",
      b: "chelsea",
      date: undefined,
    });
  });

  it("reads the internal id", () => {
    expect(parseMatchRef("laliga:2026-09-14:rayo-vallecano:espanyol", teams)).toEqual({
      a: "rayo-vallecano",
      b: "espanyol",
      date: "2026-09-14",
    });
  });

  it("does not split a club whose id has a dash in it", () => {
    expect(parseMatchRef("manchester-united-vs-brighton-2026-09-20", teams)).toEqual({
      a: "manchester-united",
      b: "brighton",
      date: "2026-09-20",
    });
    expect(parseMatchRef("manchester-united-brighton", teams)).toEqual({
      a: "manchester-united",
      b: "brighton",
      date: undefined,
    });
  });

  it("gives up rather than guess", () => {
    expect(parseMatchRef("", teams)).toBeNull();
    expect(parseMatchRef("not-a-match-at-all", teams)).toBeNull();
    expect(parseMatchRef("arsenal", teams)).toBeNull();
    expect(parseMatchRef("real-vs-real-2026-09-14", teams)).toBeNull();
  });

  it("is not upset by case, encoding or stray dashes", () => {
    expect(parseMatchRef("--Arsenal-VS-Chelsea--", teams)).toMatchObject({
      a: "arsenal",
      b: "chelsea",
    });
  });
});
