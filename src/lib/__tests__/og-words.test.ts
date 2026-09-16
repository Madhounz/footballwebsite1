import { describe, expect, it } from "vitest";
import { runs } from "@/app/og/card";

/**
 * Satori has no bidi algorithm, so a share card lays Arabic out by hand. These
 * are the splits that decide where a number lands inside an Arabic word.
 */
describe("direction runs", () => {
  it("leaves a word that never changes direction alone", () => {
    expect(runs("دقيقة،")).toEqual(["دقيقة،"]);
    expect(runs("Arsenal")).toEqual(["Arsenal"]);
    expect(runs("")).toEqual([]);
  });

  it("splits a number away from the Arabic that introduces it", () => {
    // Reversed into a row, this puts الـ on the right and 90 to its left.
    expect(runs("الـ90")).toEqual(["الـ", "90"]);
    expect(runs("90د")).toEqual(["90", "د"]);
  });

  it("keeps a number whole rather than splitting it at its own punctuation", () => {
    expect(runs("2026/27")).toEqual(["2026/27"]);
    expect(runs("1.8")).toEqual(["1.8"]);
    expect(runs("الموسم2026/27")).toEqual(["الموسم", "2026/27"]);
  });

  it("splits Arabic-Indic digits out too, so they are not shaped backwards", () => {
    expect(runs("الـ٩٠")).toEqual(["الـ", "٩٠"]);
  });
});
