import { describe, expect, it } from "vitest";
import {
  checkKeyLengths,
  GRANDFATHERED_PACKS,
  KEY_LENGTH_LIMIT,
} from "../../../scripts/lib/key-length.mjs";

const FILE = "packs/p/questions/S1.yaml";

/** A questions file with one select: 1 question whose options have these lengths and correct flags. */
function oneQuestion(
  options: { length: number; correct: unknown }[],
  select: unknown = 1,
): string {
  const opts = options
    .map(
      (o, i) =>
        `      - id: ${"ABCD"[i]}\n        text: "${"x".repeat(o.length)}"\n        correct: ${JSON.stringify(o.correct)}`,
    )
    .join("\n");
  return `questions:\n  - id: p.S1.q1\n    select: ${JSON.stringify(select)}\n    options:\n${opts}\n`;
}

const messages = (text: string, pack = "p") =>
  checkKeyLengths({ file: FILE, pack, text }).problems.map((p) => p.message);

describe("key-length constants", () => {
  it("holds the user's threshold and the three grandfathered packs", () => {
    expect(KEY_LENGTH_LIMIT).toBe(1.15);
    expect([...GRANDFATHERED_PACKS].sort()).toEqual([
      "ccdv-f",
      "platform-foundations",
      "prod-prompting",
    ]);
  });
});

describe("checkKeyLengths", () => {
  it("passes 1.1499× and fails 1.15× (boundary)", () => {
    const under = oneQuestion([
      { length: 11499, correct: true },
      { length: 10000, correct: false },
    ]);
    expect(messages(under)).toEqual([]);
    const at = oneQuestion([
      { length: 115, correct: true },
      { length: 100, correct: false },
    ]);
    expect(messages(at)).toEqual([
      `${FILE}: p.S1.q1: key is 115 chars, longest distractor 100 (1.15×, limit 1.15×)`,
    ]);
  });

  it("measures against the longest distractor", () => {
    const text = oneQuestion([
      { length: 120, correct: true },
      { length: 50, correct: false },
      { length: 110, correct: false },
    ]);
    expect(messages(text)).toEqual([]);
  });

  it("counts a grandfathered pack's question without checking it", () => {
    const text = oneQuestion([
      { length: 300, correct: true },
      { length: 10, correct: false },
    ]);
    expect(checkKeyLengths({ file: FILE, pack: "ccdv-f", text })).toEqual({
      problems: [],
      checked: 0,
      grandfathered: 1,
      multi: 0,
    });
  });

  it("counts select: 2 without checking it", () => {
    const text = oneQuestion(
      [
        { length: 300, correct: true },
        { length: 300, correct: true },
        { length: 10, correct: false },
      ],
      2,
    );
    expect(checkKeyLengths({ file: FILE, pack: "p", text })).toEqual({
      problems: [],
      checked: 0,
      grandfathered: 0,
      multi: 1,
    });
  });

  it("fails closed on key counts, missing distractors and bad option fields", () => {
    expect(
      messages(
        oneQuestion([
          { length: 5, correct: false },
          { length: 5, correct: false },
        ]),
      ),
    ).toEqual([
      `${FILE}: p.S1.q1: select: 1 needs exactly one correct option, found 0`,
    ]);
    expect(messages(oneQuestion([{ length: 5, correct: true }]))).toEqual([
      `${FILE}: p.S1.q1: select: 1 needs at least one distractor`,
    ]);
    expect(
      messages(
        oneQuestion([
          { length: 5, correct: "yes" },
          { length: 5, correct: false },
        ]),
      ),
    ).toEqual([
      `${FILE}: p.S1.q1: option 1 needs a text string and a correct boolean`,
    ]);
  });

  it("fails closed on a missing or non-integer select, a non-map item and a missing options list", () => {
    const opts = [
      { length: 5, correct: true },
      { length: 5, correct: false },
    ];
    expect(messages(oneQuestion(opts, null))).toEqual([
      `${FILE}: p.S1.q1: key-length: select must be a positive integer`,
    ]);
    expect(messages(oneQuestion(opts, "1"))).toEqual([
      `${FILE}: p.S1.q1: key-length: select must be a positive integer`,
    ]);
    expect(messages("questions:\n  - just a string\n")).toEqual([
      `${FILE}: question 1: key-length: not a question map`,
    ]);
    expect(messages("questions:\n  - id: p.S1.q9\n    select: 1\n")).toEqual([
      `${FILE}: p.S1.q9: select: 1 needs an options list`,
    ]);
  });

  it("fails closed on unparseable YAML and a file without a questions list", () => {
    expect(messages("questions:\n  - id: [unclosed\n")[0]).toMatch(
      /^packs\/p\/questions\/S1\.yaml: key-length: cannot parse YAML: /,
    );
    expect(messages("skill: S1\n")).toEqual([
      `${FILE}: key-length: no questions list`,
    ]);
  });
});

describe("review follow-ups (MF-0044 review minors)", () => {
  it("still reports a malformed question in a grandfathered pack; only the length comparison is skipped", () => {
    const noKey = oneQuestion([
      { length: 5, correct: false },
      { length: 5, correct: false },
    ]);
    expect(
      checkKeyLengths({ file: FILE, pack: "ccdv-f", text: noKey }),
    ).toEqual({
      problems: [
        {
          file: FILE,
          rule: "key-length",
          message: `${FILE}: p.S1.q1: select: 1 needs exactly one correct option, found 0`,
        },
      ],
      checked: 0,
      grandfathered: 1,
      multi: 0,
    });
  });

  it("names empty distractors instead of printing Infinity", () => {
    const text = oneQuestion([
      { length: 10, correct: true },
      { length: 0, correct: false },
    ]);
    expect(messages(text)).toEqual([
      `${FILE}: p.S1.q1: every distractor is empty`,
    ]);
  });

  it("counts characters as code points and ignores a block's trailing newline", () => {
    const emoji = `questions:\n  - id: p.S1.q1\n    select: 1\n    options:\n      - id: A\n        text: "${"😀".repeat(110)}"\n        correct: true\n      - id: B\n        text: "${"x".repeat(100)}"\n        correct: false\n`;
    expect(messages(emoji)).toEqual([]);
    const block = `questions:\n  - id: p.S1.q1\n    select: 1\n    options:\n      - id: A\n        text: |\n          ${"k".repeat(114)}\n        correct: true\n      - id: B\n        text: "${"x".repeat(100)}"\n        correct: false\n`;
    expect(messages(block)).toEqual([]);
  });
});
