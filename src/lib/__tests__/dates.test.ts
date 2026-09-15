import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatLongDate,
  formatShortDate,
  isISODate,
  relativeDayKey,
} from "../dates";

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
    expect(relativeDayKey("2026-09-15", "2026-09-15")).toBe("today");
    expect(relativeDayKey("2026-09-14", "2026-09-15")).toBe("yesterday");
    expect(relativeDayKey("2026-09-16", "2026-09-15")).toBe("tomorrow");
    expect(relativeDayKey("2026-09-19", "2026-09-15")).toBeNull();
  });
  it("formats in English and Arabic with Western digits", () => {
    expect(formatShortDate("2026-09-19", "en")).toBe("Sat 19 Sep");
    expect(formatLongDate("2026-09-19", "en")).toBe("Saturday, 19 September 2026");
    const ar = formatShortDate("2026-09-19", "ar");
    expect(ar).toContain("19");
    expect(ar).toMatch(/سبتمبر/);
    expect(ar).not.toMatch(/[٠-٩]/);
  });
});
