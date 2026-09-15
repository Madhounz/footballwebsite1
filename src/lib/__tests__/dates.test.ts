import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isISODate, relativeDayLabel } from "../dates";

describe("dates", () => {
  it("validates ISO dates strictly", () => {
    expect(isISODate("2026-09-15")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("15-09-2026")).toBe(false);
    expect(isISODate(undefined)).toBe(false);
  });
  it("adds days across month boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(daysBetween("2026-09-15", "2026-11-03")).toBe(49);
  });
  it("labels relative days", () => {
    expect(relativeDayLabel("2026-09-15", "2026-09-15")).toBe("Today");
    expect(relativeDayLabel("2026-09-14", "2026-09-15")).toBe("Yesterday");
    expect(relativeDayLabel("2026-09-16", "2026-09-15")).toBe("Tomorrow");
    expect(relativeDayLabel("2026-09-19", "2026-09-15")).toBe("Sat 19 Sep");
  });
});
