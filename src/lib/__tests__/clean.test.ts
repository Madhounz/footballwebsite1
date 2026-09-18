import { describe, expect, it } from "vitest";
import { foundedYear, place } from "../clean";

describe("place", () => {
  it("keeps a place", () => {
    expect(place("London")).toBe("London");
    expect(place("Saint-Étienne")).toBe("Saint-Étienne");
    expect(place("  Kraków ")).toBe("Kraków");
    expect(place("الرياض")).toBe("الرياض");
    // A name with a number in it is still a name.
    expect(place("Mainz 05")).toBe("Mainz 05");
    expect(place("1. FC Köln")).toBe("1. FC Köln");
  });

  it("drops the provider's empties", () => {
    for (const junk of ["", "   ", "null", "NULL", "undefined", "N/A", "-", "unknown", "?"]) {
      expect(place(junk)).toBe("");
    }
    expect(place(null)).toBe("");
    expect(place(undefined)).toBe("");
  });

  it("drops a postal code pretending to be a city", () => {
    // The ones actually on the site today.
    expect(place("8200")).toBe("");
    expect(place("4350-451")).toBe("");
    expect(place("7501")).toBe("");
    expect(place("75016")).toBe("");
    expect(place("SW6 1HS")).toBe("");
  });
});

describe("foundedYear", () => {
  it("keeps a year a club could have been founded in", () => {
    expect(foundedYear(1886)).toBe(1886);
    expect(foundedYear(1857)).toBe(1857);
  });

  it("drops a missing value with a number in it", () => {
    expect(foundedYear(0)).toBeNull();
    expect(foundedYear(1)).toBeNull();
    expect(foundedYear(1700)).toBeNull();
    expect(foundedYear(null)).toBeNull();
    expect(foundedYear(undefined)).toBeNull();
    expect(foundedYear(Number.NaN)).toBeNull();
    expect(foundedYear(2099, new Date("2026-09-18T00:00:00Z"))).toBeNull();
  });
});
