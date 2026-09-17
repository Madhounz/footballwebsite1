import { describe, expect, it } from "vitest";
import { isCalendarYear, seasonLabel, seasonWindow, seasonWindowFor, seasonYear } from "../season";
import type { ISODate } from "../dates";

const sept = "2026-09-17" as ISODate;
const march = "2027-03-04" as ISODate;

describe("seasonYear", () => {
  it("reads a European season from the July boundary", () => {
    expect(seasonYear("epl", sept)).toBe(2026);
    expect(seasonYear("epl", march)).toBe(2026);
    expect(seasonYear("epl", "2026-06-30" as ISODate)).toBe(2025);
    expect(seasonYear("epl", "2026-07-01" as ISODate)).toBe(2026);
  });

  it("gives a calendar-year league the year it is in", () => {
    expect(seasonYear("brasileirao", sept)).toBe(2026);
    // The European season has not turned over in March; the Brazilian one has.
    expect(seasonYear("brasileirao", march)).toBe(2027);
    expect(seasonYear("brasileirao", "2026-01-02" as ISODate)).toBe(2026);
  });
});

describe("seasonLabel", () => {
  it("writes two years for a season played across two", () => {
    expect(seasonLabel("epl", sept)).toBe("2026/27");
    expect(seasonLabel("ucl", "2029-08-01" as ISODate)).toBe("2029/30");
  });

  it("writes one year where the season is one year", () => {
    expect(seasonLabel("brasileirao", sept)).toBe("2026");
    expect(seasonLabel("brasileirao", march)).toBe("2027");
  });
});

describe("seasonWindow", () => {
  it("covers July to June, or January to December", () => {
    expect(seasonWindow("epl", sept)).toEqual({ fromDate: "2026-07-01", toDate: "2027-06-30" });
    expect(seasonWindow("brasileirao", sept)).toEqual({
      fromDate: "2026-01-01",
      toDate: "2026-12-31",
    });
  });

  it("covers every competition in the run at once", () => {
    expect(seasonWindowFor(["epl", "brasileirao"], sept)).toEqual({
      fromDate: "2026-01-01",
      toDate: "2027-06-30",
    });
    expect(seasonWindowFor(["epl", "laliga"], sept)).toEqual({
      fromDate: "2026-07-01",
      toDate: "2027-06-30",
    });
    expect(seasonWindowFor([], sept).toDate).toBe("2027-06-30");
  });
});

describe("isCalendarYear", () => {
  it("is only true for the competitions named", () => {
    expect(isCalendarYear("brasileirao")).toBe(true);
    for (const id of ["epl", "laliga", "championship", "eredivisie", "primeira", "ucl"]) {
      expect(isCalendarYear(id)).toBe(false);
    }
  });
});
