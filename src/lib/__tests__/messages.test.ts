import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "../../../messages/en.json";
import ar from "../../../messages/ar.json";

/**
 * The translation files are the only part of the site that nothing else was
 * checking. They are JSON read at request time, so a malformed one builds
 * perfectly and then fails on the first page view — which is exactly what
 * happened: a stray escape left `}\n` on the end of both files and every
 * check in the repository still passed.
 *
 * These four tests cost nothing and cover the whole class: the files parse,
 * the two languages say the same things, nothing is blank, and no sentence
 * asks for a value the other language does not.
 */
type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const at = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(at, value);
    else for (const [k, v] of flatten(value, at)) out.set(k, v);
  }
  return out;
}

/**
 * `{name}`, `{n, plural, …}` — the values a sentence needs to be rendered.
 *
 * Only the outermost braces: inside a plural, `one {minute}` is the word
 * "minute", not an argument called minute, and a regular expression that does
 * not count depth reports every plural branch as a missing translation.
 */
function args(message: string): Set<string> {
  const found = new Set<string>();
  let depth = 0;
  for (let i = 0; i < message.length; i++) {
    if (message[i] === "{") {
      depth++;
      if (depth === 1) {
        const name = message.slice(i + 1).match(/^\s*([a-zA-Z_]\w*)\s*[,}]/);
        if (name) found.add(name[1]);
      }
    } else if (message[i] === "}") {
      depth--;
    }
  }
  return found;
}

const english = flatten(en as Tree);
const arabic = flatten(ar as Tree);

describe("translations", () => {
  it("are valid JSON on disk, not just as imported", () => {
    for (const file of ["en.json", "ar.json"]) {
      const raw = readFileSync(path.join(process.cwd(), "messages", file), "utf8");
      expect(() => JSON.parse(raw)).not.toThrow();
      expect(raw.endsWith("}\n")).toBe(true);
    }
  });

  it("say the same things in both languages", () => {
    const missingFromArabic = [...english.keys()].filter((k) => !arabic.has(k));
    const missingFromEnglish = [...arabic.keys()].filter((k) => !english.has(k));
    expect({ missingFromArabic, missingFromEnglish }).toEqual({
      missingFromArabic: [],
      missingFromEnglish: [],
    });
  });

  it("have nothing blank in them", () => {
    expect([...english].filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
    expect([...arabic].filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
  });

  it("ask for the same values in both languages", () => {
    // A sentence that takes {competitions} in English and not in Arabic is a
    // placeholder waiting to be printed at somebody.
    const mismatched: string[] = [];
    for (const [key, value] of english) {
      const here = args(value);
      const there = args(arabic.get(key) ?? "");
      const same = here.size === there.size && [...here].every((a) => there.has(a));
      if (!same) mismatched.push(`${key}: en(${[...here]}) ar(${[...there]})`);
    }
    expect(mismatched).toEqual([]);
  });
});
