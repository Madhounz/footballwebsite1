import { describe, expect, it } from "vitest";
import { matchPlayer } from "../pipeline/players";

const squad = [
  { id: "p1", name: "Bukayo Saka", shirtNumber: 7 },
  { id: "p2", name: "Martin Ødegaard", shirtNumber: 8 },
  { id: "p3", name: "Gabriel Magalhães", shirtNumber: 6 },
  { id: "p4", name: "Gabriel Martinelli", shirtNumber: 11 },
  { id: "p5", name: "Virgil van Dijk", shirtNumber: 4 },
  { id: "p6", name: "David Raya", shirtNumber: 22 },
];

describe("matchPlayer", () => {
  it("matches abbreviated and accent-less spellings", () => {
    expect(matchPlayer({ externalId: "x", name: "B. Saka" }, squad)).toBe("p1");
    expect(matchPlayer({ externalId: "x", name: "M. Odegaard" }, squad)).toBe("p2");
    expect(matchPlayer({ externalId: "x", name: "Virgil van Dijk" }, squad)).toBe("p5");
    expect(matchPlayer({ externalId: "x", name: "V. van Dijk" }, squad)).toBe("p5");
  });
  it("uses the initial or shirt number to split shared names", () => {
    expect(matchPlayer({ externalId: "x", name: "G. Martinelli" }, squad)).toBe("p4");
    expect(matchPlayer({ externalId: "x", name: "Gabriel", shirtNumber: 6 }, squad)).toBe("p3");
  });
  it("refuses to guess", () => {
    expect(matchPlayer({ externalId: "x", name: "Gabriel" }, squad)).toBeNull();
    expect(matchPlayer({ externalId: "x", name: "K. Havertz" }, squad)).toBeNull();
  });
});
