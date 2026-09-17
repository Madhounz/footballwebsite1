import { describe, expect, it } from "vitest";
import {
  buildMatchContext,
  clubsInForm,
  currentStreak,
  headToHead,
  per,
  resultFor,
  teamRecord,
} from "../data/match-context";
import { barColors, clubTint, distinctColors } from "../colors";
import type { Competition, MatchView, Team } from "../types";

const competition = { id: "epl", shortName: "PL" } as Competition;
const team = (id: string) => ({ id, slug: id, name: id, shortName: id }) as Team;

let n = 0;
/** One finished match, oldest first in the order they are declared. */
function played(homeId: string, awayId: string, home: number, away: number): MatchView {
  n++;
  return {
    competition,
    home: team(homeId),
    away: team(awayId),
    match: {
      id: `m${n}`,
      status: "finished",
      score: { home, away },
      kickoff: `2026-09-${String(n).padStart(2, "0")}T14:00:00.000Z`,
    },
  } as MatchView;
}

function scheduled(homeId: string, awayId: string): MatchView {
  n++;
  return {
    competition,
    home: team(homeId),
    away: team(awayId),
    match: { id: `m${n}`, status: "scheduled", score: null, kickoff: "2026-10-01T14:00:00.000Z" },
  } as MatchView;
}

describe("match context", () => {
  it("reads a result from either side of the scoreline", () => {
    const v = played("arsenal", "chelsea", 2, 1);
    expect(resultFor(v, "arsenal")).toBe("W");
    expect(resultFor(v, "chelsea")).toBe("L");
    expect(resultFor(v, "spurs")).toBeNull();
    expect(resultFor(scheduled("arsenal", "chelsea"), "arsenal")).toBeNull();
  });

  it("counts a record for one side of the season only", () => {
    const matches = [
      played("arsenal", "chelsea", 3, 0),
      played("spurs", "arsenal", 1, 1),
      played("arsenal", "spurs", 0, 2),
      played("chelsea", "arsenal", 0, 0),
      scheduled("arsenal", "everton"),
    ];
    const all = teamRecord(matches, "arsenal");
    expect(all).toMatchObject({
      played: 4,
      won: 1,
      drawn: 2,
      lost: 1,
      goalsFor: 4,
      goalsAgainst: 3,
    });
    // Two clean sheets, and one match they did not score in.
    expect(all.cleanSheets).toBe(2);
    expect(all.blanks).toBe(2);

    const home = teamRecord(matches, "arsenal", "home");
    expect(home).toMatchObject({ played: 2, won: 1, lost: 1, goalsFor: 3, goalsAgainst: 2 });
    const away = teamRecord(matches, "arsenal", "away");
    expect(away).toMatchObject({ played: 2, won: 0, drawn: 2, goalsFor: 1, goalsAgainst: 1 });
  });

  it("gives goals a match without dividing by nothing", () => {
    expect(per(7, 4)).toBe(1.8);
    expect(per(0, 0)).toBe(0);
  });

  it("prefers a repeated result, then an unbeaten run, then nothing", () => {
    const wins = [
      played("arsenal", "a", 1, 0),
      played("arsenal", "b", 0, 1),
      played("arsenal", "c", 2, 0),
      played("arsenal", "d", 3, 1),
    ];
    expect(currentStreak(wins, "arsenal")).toEqual({ kind: "W", count: 2 });

    // W D D: no repeated result at the front long enough to beat an unbeaten run.
    const unbeaten = [
      played("arsenal", "a", 0, 3),
      played("arsenal", "b", 1, 0),
      played("arsenal", "c", 1, 1),
      played("arsenal", "d", 2, 2),
    ];
    expect(currentStreak(unbeaten, "arsenal")).toEqual({ kind: "D", count: 2 });

    // A single result at the front, and only two matches behind it: no run to claim.
    const quiet = [played("arsenal", "a", 1, 0), played("arsenal", "b", 0, 2)];
    expect(currentStreak(quiet, "arsenal")).toBeNull();
    expect(currentStreak([], "arsenal")).toBeNull();
  });

  it("counts head to head from this fixture's home side, wherever it was played", () => {
    const matches = [
      played("arsenal", "chelsea", 2, 0), // Arsenal win at home
      played("chelsea", "arsenal", 3, 1), // Arsenal lose away
      played("chelsea", "arsenal", 1, 1),
      played("arsenal", "spurs", 5, 0), // different opponent, ignored
    ];
    const h = headToHead(matches, "arsenal", "chelsea");
    expect(h).toMatchObject({
      played: 3,
      homeWins: 1,
      draws: 1,
      awayWins: 1,
      homeGoals: 4,
      awayGoals: 4,
    });
    expect(h.recent).toHaveLength(3);
    // Most recent first.
    expect(h.recent[0].match.id).toBe(matches[2].match.id);
  });

  it("leaves the match being previewed out of its own context", () => {
    const fixture = scheduled("arsenal", "chelsea");
    const matches = [played("arsenal", "chelsea", 2, 0), fixture];
    const ctx = buildMatchContext({
      homeId: "arsenal",
      awayId: "chelsea",
      homeMatches: matches,
      awayMatches: matches,
      rows: [],
      excludeMatchId: fixture.match.id,
    });
    expect(ctx.home.overall.played).toBe(1);
    expect(ctx.h2h.played).toBe(1);
    expect(ctx.hasAnything).toBe(true);

    // A finished match must not count itself towards its own build-up either.
    const done = played("arsenal", "chelsea", 1, 1);
    const after = buildMatchContext({
      homeId: "arsenal",
      awayId: "chelsea",
      homeMatches: [done],
      awayMatches: [done],
      rows: [],
      excludeMatchId: done.match.id,
    });
    expect(after.home.overall.played).toBe(0);
    expect(after.h2h.played).toBe(0);
    expect(after.hasAnything).toBe(false);
  });

  it("takes each club's league row and the right side of their season", () => {
    const matches = [
      played("arsenal", "chelsea", 1, 0),
      played("chelsea", "arsenal", 2, 2),
      played("chelsea", "spurs", 0, 1),
    ];
    const ctx = buildMatchContext({
      homeId: "arsenal",
      awayId: "chelsea",
      homeMatches: matches,
      awayMatches: matches,
      rows: [{ teamId: "chelsea", position: 4, points: 9 }] as never,
    });
    expect(ctx.home.row).toBeNull();
    expect(ctx.away.row?.position).toBe(4);
    // Arsenal's home record, Chelsea's away record — the sides they play here.
    expect(ctx.home.side.played).toBe(1);
    expect(ctx.away.side.played).toBe(1);
    expect(ctx.home.form[0].result).toBe("D");
  });
});

describe("bar colours", () => {
  const club = (id: string, colors: [string, string]) => ({ ...team(id), colors }) as Team;

  it("keeps two club colours when they are far enough apart", () => {
    const c = barColors(club("city", ["#6CABDD", "#1C2C5B"]), club("chelsea", ["#034694", "#fff"]));
    expect(c).toEqual({ home: "#6CABDD", away: "#034694" });
  });

  it("moves the away side off a colour clash — two reds is a chart in one colour", () => {
    const liverpool = club("liverpool", ["#C8102E", "#00B2A9"]);
    const united = club("united", ["#DA291C", "#FBE122"]);
    const c = barColors(liverpool, united);
    expect(c.home).toBe("#C8102E");
    // Their second colour is nothing like Liverpool's red, so it is used.
    expect(c.away).toBe("#FBE122");
  });

  it("falls back to a neutral when a club has no second colour to offer", () => {
    const c = barColors(club("a", ["#C8102E", "#C9112F"]), club("b", ["#DA291C", "#D5202A"]));
    expect(c.away).toBe("var(--text-muted)");
  });
});

describe("clubs in form", () => {
  const row = (teamId: string, form: string) => ({ teamId, form: form.split("") }) as never;

  it("ranks win streaks above unbeaten runs, longest first", () => {
    const out = clubsInForm([
      {
        competitionId: "epl",
        rows: [row("three-wins", "LLWWW"), row("five-unbeaten", "DWDWD"), row("two-wins", "LLLWW")],
      },
      { competitionId: "laliga", rows: [row("four-wins", "LWWWW")] },
    ]);
    expect(out.map((e) => e.teamId)).toEqual([
      "four-wins",
      "three-wins",
      "two-wins",
      "five-unbeaten",
    ]);
    expect(out[0].streak).toEqual({ kind: "W", count: 4 });
    // Read backwards from the most recent match, not forwards from the oldest.
    expect(out[0].form[0]).toBe("W");
  });

  it("leaves out bad runs and clubs on no run at all", () => {
    const out = clubsInForm([
      {
        competitionId: "epl",
        rows: [row("losing", "WLLLL"), row("winless", "WDLDL"), row("nothing", "WLWLW")],
      },
    ]);
    expect(out).toEqual([]);
  });

  it("takes the best few across every competition", () => {
    const rows = ["a", "b", "c", "d", "e", "f", "g"].map((id) => row(id, "LWWWW"));
    expect(clubsInForm([{ competitionId: "epl", rows }], 3)).toHaveLength(3);
  });
});

describe("distinct colours", () => {
  const club = (id: string, colors: string[]) => ({ id, colors });

  const hue = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    if (d === 0) return 0;
    const h =
      max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };

  it("leaves a club its own colour when it is readable and nobody else is wearing it", () => {
    const c = distinctColors([club("city", ["#6CABDD", "#1C2C5B"])]);
    expect(c.get("city")).toBe("#6CABDD");
  });

  it("keeps a dark club colour's hue and only lifts it into view", () => {
    // Chelsea blue against a near-black page is barely a line at all. What is
    // drawn is the same blue, brighter — not a different club's colour.
    const drawn = distinctColors([club("chelsea", ["#034694", "#ffffff"])]).get(
      "chelsea",
    ) as string;
    expect(drawn).not.toBe("#034694");
    expect(Math.abs(hue(drawn) - hue("#034694"))).toBeLessThan(4);
  });

  it("moves the second of two reds onto its own second colour", () => {
    const c = distinctColors([
      club("liverpool", ["#C8102E", "#00B2A9"]),
      club("united", ["#DA291C", "#FBE122"]),
    ]);
    expect(c.get("liverpool")).toBe("#C8102E");
    expect(c.get("united")).toBe("#FBE122");
  });

  it("reaches for a spare when a club has no colour of its own left to give", () => {
    const c = distinctColors([
      club("a", ["#C8102E", "#C9112F"]),
      club("b", ["#DA291C", "#D5202A"]),
    ]);
    expect(c.get("a")).toBe("#C8102E");
    expect(c.get("b")).not.toBe(c.get("a"));
    expect(c.get("b")).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("gives every club on a crowded chart a colour of its own", () => {
    const reds = [
      "#C8102E",
      "#DA291C",
      "#EF0107",
      "#D00027",
      "#E30613",
      "#C70101",
      "#B80A1E",
      "#FF0000",
    ];
    const c = distinctColors(reds.map((hex, i) => club(`t${i}`, [hex])));
    expect(new Set(c.values()).size).toBe(reds.length);
  });

  it("is the same chart every time", () => {
    const clubs = [club("a", ["#C8102E"]), club("b", ["#DA291C"]), club("c", ["#034694"])];
    expect([...distinctColors(clubs)]).toEqual([...distinctColors(clubs)]);
  });
});

describe("line colours survive both themes", () => {
  it("refuses a club's white second colour, which the light theme would swallow", () => {
    const c = distinctColors([
      { id: "brighton", colors: ["#0057B8", "#FFFFFF"] },
      { id: "chelsea", colors: ["#034694", "#FFFFFF"] },
    ]);
    expect(c.get("chelsea")).not.toBe("#FFFFFF");
    expect(c.get("chelsea")).not.toBe("#034694");
  });

  it("refuses a near-black one too", () => {
    const c = distinctColors([{ id: "a", colors: ["#111111", "#000000"] }]);
    expect(c.get("a")).not.toBe("#111111");
    expect(c.get("a")).not.toBe("#000000");
  });
});

describe("two lines a reader can tell apart", () => {
  const hueOf = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    if (d === 0) return 0;
    const h =
      max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  const apart = (a: string, b: string) => {
    const d = Math.abs(hueOf(a) - hueOf(b));
    return Math.min(d, 360 - d);
  };

  it("does not hand two blue clubs two blues, however far apart the arithmetic says they are", () => {
    // Brighton and Chelsea. One of them has to take a colour that is not
    // theirs, because two blue lines on one chart cannot be followed — which
    // is the whole job of the chart, and why the key names every colour.
    const c = distinctColors([
      { id: "brighton", colors: ["#0057B8", "#FFFFFF"] },
      { id: "chelsea", colors: ["#034694", "#FFFFFF"] },
    ]);
    expect(apart(c.get("brighton") as string, c.get("chelsea") as string)).toBeGreaterThanOrEqual(
      35,
    );
  });

  it("keeps every line on a crowded chart in a different colour family", () => {
    const reds = ["#C8102E", "#DA291C", "#EF0107", "#D00027", "#E30613", "#C70101"];
    const drawn = [
      ...distinctColors(reds.map((hex, i) => ({ id: `t${i}`, colors: [hex] }))).values(),
    ];
    for (let i = 0; i < drawn.length; i++)
      for (let j = i + 1; j < drawn.length; j++)
        expect(apart(drawn[i], drawn[j])).toBeGreaterThanOrEqual(35);
  });
});

describe("clubTint", () => {
  it("keeps a club's hue and makes it survive both themes", () => {
    // Arsenal red comes back red; a navy is lifted until it can be seen.
    expect(clubTint(["#EF0107", "#FFFFFF"])).toMatch(/^#/);
    const navy = clubTint(["#0b1d51"])!;
    expect(navy).not.toBe("#0b1d51");
    expect(navy).toMatch(/^#/);
  });

  it("falls through a colourless first choice to the second", () => {
    expect(clubTint(["#FFFFFF", "#1b458f"])).not.toBeNull();
  });

  it("gives nothing for a club that plays in black and white", () => {
    expect(clubTint(["#FFFFFF", "#000000"])).toBeNull();
    expect(clubTint([])).toBeNull();
    expect(clubTint(undefined)).toBeNull();
  });
});
