import { describe, expect, it } from "vitest";
import { monogram } from "@/components/NameCrest";

describe("monogram", () => {
  it("takes the initials of a club with more than one word", () => {
    expect(monogram("Sheffield Wednesday")).toBe("SW");
    expect(monogram("Leicester City")).toBe("LC");
    // Never the first three letters of "Nottingham".
    expect(monogram("Nottingham Forest")).toBe("NF");
    expect(monogram("Bolton Wanderers Reserves Extra")).toBe("BWR");
  });

  it("takes three letters of a club that is one word", () => {
    expect(monogram("Juventus")).toBe("JUV");
    expect(monogram("Ajax")).toBe("AJA");
  });

  it("ignores punctuation and empty names", () => {
    expect(monogram("Nott'm Forest")).toBe("NF");
    expect(monogram("  ")).toBe("");
    expect(monogram("")).toBe("");
  });
});
