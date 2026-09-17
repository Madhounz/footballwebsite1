import { describe, expect, it } from "vitest";
import {
  LIVE_LIMIT_MIN,
  isLive,
  isStaleLive,
  minutesSinceKickoff,
  liveCountTitle,
} from "../live-status";

const at = (minutesAgo: number) => ({
  status: "live" as const,
  kickoff: new Date(Date.UTC(2026, 8, 16, 19, 0) - minutesAgo * -60_000).toISOString(),
});
const now = new Date(Date.UTC(2026, 8, 16, 19, 0));
const kickedOff = (minutesAgo: number) => ({
  status: "live" as const,
  kickoff: new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
});

describe("live status", () => {
  it("measures how long ago a match kicked off", () => {
    expect(minutesSinceKickoff(kickedOff(45).kickoff, now)).toBe(45);
    // A match that has not started yet is a negative number, not a large one.
    expect(minutesSinceKickoff(at(0).kickoff, now)).toBe(0);
  });

  it("believes a match that kicked off recently", () => {
    expect(isLive(kickedOff(0), now)).toBe(true);
    expect(isLive(kickedOff(95), now)).toBe(true);
    // Extra time and penalties still fit.
    expect(isLive(kickedOff(150), now)).toBe(true);
    expect(isLive(kickedOff(LIVE_LIMIT_MIN), now)).toBe(true);
  });

  it("stops believing one that has been live for longer than a match can last", () => {
    const abandoned = kickedOff(LIVE_LIMIT_MIN + 1);
    expect(isLive(abandoned, now)).toBe(false);
    expect(isStaleLive(abandoned, now)).toBe(true);
    // Hours later it is still stale rather than quietly becoming live again.
    expect(isStaleLive(kickedOff(60 * 24), now)).toBe(true);
  });

  it("says nothing about a match that is not marked live", () => {
    for (const status of ["scheduled", "finished", "postponed", "cancelled"] as const) {
      const m = { ...kickedOff(60 * 24), status };
      expect(isLive(m, now)).toBe(false);
      expect(isStaleLive(m, now)).toBe(false);
    }
  });
});

describe("what the tab says", () => {
  it("counts the matches in play, and keeps quiet when there are none", () => {
    expect(liveCountTitle(3, "ninety")).toBe("(3) ninety");
    expect(liveCountTitle(0, "ninety")).toBe("ninety");
  });
});
