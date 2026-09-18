import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatLongDate,
  formatShortDate,
  isISODate,
  relativeDayKey,
  todayIn,
  isTimeZone,
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

describe("the reader's own day", () => {
  // Half past midnight in Warsaw on the 18th is half past ten at night in UTC
  // on the 17th. The front page has to say the 18th.
  const justAfterMidnightInWarsaw = new Date("2026-09-17T22:30:00.000Z");

  it("reads the day in the visitor's zone, not the server's", () => {
    expect(todayIn("Europe/Warsaw", justAfterMidnightInWarsaw)).toBe("2026-09-18");
    expect(todayIn("UTC", justAfterMidnightInWarsaw)).toBe("2026-09-17");
    expect(todayIn("America/Los_Angeles", justAfterMidnightInWarsaw)).toBe("2026-09-17");
    expect(todayIn("Pacific/Auckland", justAfterMidnightInWarsaw)).toBe("2026-09-18");
  });

  it("falls back to UTC when it is given nothing, or nonsense", () => {
    expect(todayIn(undefined, justAfterMidnightInWarsaw)).toBe("2026-09-17");
    expect(todayIn("Moon/Base", justAfterMidnightInWarsaw)).toBe("2026-09-17");
  });

  it("only accepts a zone name Intl will take", () => {
    expect(isTimeZone("Europe/Warsaw")).toBe(true);
    expect(isTimeZone("UTC")).toBe(true);
    expect(isTimeZone("Moon/Base")).toBe(false);
    expect(isTimeZone("")).toBe(false);
    expect(isTimeZone(undefined)).toBe(false);
    expect(isTimeZone("'; DROP TABLE")).toBe(false);
    expect(isTimeZone("a".repeat(200))).toBe(false);
  });
});
