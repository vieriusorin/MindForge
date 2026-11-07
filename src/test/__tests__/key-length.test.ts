import { describe, expect, it } from "vitest";
import * as keyLength from "../../../scripts/lib/key-length.mjs";
import {
  checkKeyLengths,
  KEY_LENGTH_LIMIT,
  KEY_RANK_LIMIT,
  KEY_RANK_MIN_QUESTIONS,
  keyRankProblems,
  rankName,
} from "../../../scripts/lib/key-length.mjs";

const FILE = "packs/p/questions/S1.yaml";

/** A questions file with one select: 1 question whose options have these lengths and correct flags. */
function oneQuestion(
  options: { length: number; correct: unknown }[],
  select: unknown = 1,
  origin?: string,
): string {
  const opts = options
    .map(
      (o, i) =>
        `      - id: ${"ABCD"[i]}\n        text: "${"x".repeat(o.length)}"\n        correct: ${JSON.stringify(o.correct)}`,
    )
    .join("\n");
  const originLine = origin === undefined ? "" : `    origin: ${origin}\n`;
  return `questions:\n  - id: p.S1.q1\n${originLine}    select: ${JSON.stringify(select)}\n    options:\n${opts}\n`;
}

const messages = (text: string) =>
  checkKeyLengths({ file: FILE, text }).problems.map((p) => p.message);

/** A 300-char key against a 10-char distractor: far over the limit. */
const longKey = [
  { length: 300, correct: true },
  { length: 10, correct: false },
];

describe("key-length constants", () => {
  it("holds the user's threshold; MF-0061 removed the pack grandfather set", () => {
    expect(KEY_LENGTH_LIMIT).toBe(1.15);
    expect("GRANDFATHERED_PACKS" in keyLength).toBe(false);
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

  it("MF-0061: counts an origin: official question without checking its length", () => {
    const text = oneQuestion(longKey, 1, "official");
    expect(checkKeyLengths({ file: FILE, text })).toEqual({
      problems: [],
      checked: 0,
      skippedOfficial: 1,
      multi: 0,
      keyRanks: {},
    });
  });

  it("MF-0061: checks every other origin, including a missing one; no case-folding", () => {
    const fail = `${FILE}: p.S1.q1: key is 300 chars, longest distractor 10 (30.00×, limit 1.15×)`;
    for (const origin of ["ai", "human", "Official", undefined])
      expect(
        checkKeyLengths({ file: FILE, text: oneQuestion(longKey, 1, origin) }),
        String(origin),
      ).toEqual({
        problems: [{ file: FILE, rule: "key-length", message: fail }],
        checked: 1,
        skippedOfficial: 0,
        multi: 0,
        keyRanks: { longest: 1 },
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
    expect(checkKeyLengths({ file: FILE, text })).toEqual({
      problems: [],
      checked: 0,
      skippedOfficial: 0,
      multi: 1,
      keyRanks: {},
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
  it("still reports a malformed official question; only the length comparison is skipped (MF-0061)", () => {
    const noKey = oneQuestion(
      [
        { length: 5, correct: false },
        { length: 5, correct: false },
      ],
      1,
      "official",
    );
    expect(checkKeyLengths({ file: FILE, text: noKey })).toEqual({
      problems: [
        {
          file: FILE,
          rule: "key-length",
          message: `${FILE}: p.S1.q1: select: 1 needs exactly one correct option, found 0`,
        },
      ],
      checked: 0,
      skippedOfficial: 1,
      multi: 0,
      keyRanks: {},
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

describe("key rank (MF-0061 U-7)", () => {
  /** One questions file whose select: 1 questions have [key, ...distractors] lengths. */
  const file = (
    rows: { lengths: number[]; origin?: string; select?: number }[],
  ) =>
    `questions:\n${rows
      .map(
        (r, i) =>
          `  - id: p.S1.q${i + 1}\n${r.origin ? `    origin: ${r.origin}\n` : ""}    select: ${r.select ?? 1}\n    options:\n${r.lengths
            .map(
              (n, j) =>
                `      - id: ${"ABCD"[j]}\n        text: "${"x".repeat(n)}"\n        correct: ${j === 0 || (r.select === 2 && j === 1)}`,
            )
            .join("\n")}`,
      )
      .join("\n")}\n`;

  it("ranks the key by options strictly longer than it; a tie shares the better rank; official and multi-select are not ranked", () => {
    const result = checkKeyLengths({
      file: FILE,
      text: file([
        { lengths: [110, 100, 90, 80] },
        { lengths: [100, 100, 90, 80] },
        { lengths: [95, 100, 90, 80] },
        { lengths: [85, 100, 90, 80] },
        { lengths: [75, 100, 90, 80] },
        { lengths: [80, 100, 90, 80] },
        { lengths: [110, 100, 90, 80], origin: "official" },
        { lengths: [110, 110, 10, 10], select: 2 },
      ]),
    });
    expect(result.keyRanks).toEqual({
      longest: 2,
      "2nd longest": 1,
      "3rd longest": 2,
      shortest: 1,
    });
    expect(result.checked).toBe(6);
  });

  it("counts a malformed question in checked but gives it no rank", () => {
    const result = checkKeyLengths({
      file: FILE,
      text: file([{ lengths: [110, 100] }]).replace(
        "correct: true",
        "correct: false",
      ),
    });
    expect(result.checked).toBe(1);
    expect(result.keyRanks).toEqual({});
    expect(result.problems).toHaveLength(1);
  });

  it("passes at 40%, fails above it with the share rounded up, and skips a pack under 10 questions", () => {
    expect(KEY_RANK_LIMIT).toBe(0.4);
    expect(KEY_RANK_MIN_QUESTIONS).toBe(10);
    expect(
      keyRankProblems({
        pack: "p",
        checked: 10,
        keyRanks: {
          longest: 4,
          "2nd longest": 3,
          "3rd longest": 3,
          shortest: 0,
        },
      }),
    ).toEqual([]);
    expect(
      keyRankProblems({ pack: "p", checked: 9, keyRanks: { longest: 9 } }),
    ).toEqual([]);
    expect(keyRankProblems({ pack: "p", checked: 0, keyRanks: {} })).toEqual(
      [],
    );
    expect(
      keyRankProblems({
        pack: "p",
        checked: 1000,
        keyRanks: {
          longest: 401,
          "2nd longest": 300,
          "3rd longest": 200,
          shortest: 99,
        },
      }).map((p) => p.message),
    ).toEqual([
      "p: key-rank: key is the longest option in 401 of 1000 single-select questions (41%, limit 40%)",
    ]);
    expect(
      keyRankProblems({
        pack: "p",
        checked: 20,
        keyRanks: { shortest: 11, "2nd longest": 9 },
      }),
    ).toEqual([
      {
        file: "packs/p",
        rule: "key-rank",
        message:
          "p: key-rank: key is the 2nd longest option in 9 of 20 single-select questions (45%, limit 40%)",
      },
      {
        file: "packs/p",
        rule: "key-rank",
        message:
          "p: key-rank: key is the shortest option in 11 of 20 single-select questions (55%, limit 40%)",
      },
    ]);
  });

  it("names ranks correctly for 2- to 6-option questions; shortest only for the actual last rank (review 3 note 3)", () => {
    expect(rankName(1, 2)).toBe("longest");
    expect(rankName(2, 2)).toBe("shortest");
    expect(rankName(2, 3)).toBe("2nd longest");
    expect(rankName(3, 3)).toBe("shortest");
    expect(rankName(3, 4)).toBe("3rd longest");
    expect(rankName(4, 4)).toBe("shortest");
    expect(rankName(4, 5)).toBe("4th longest");
    expect(rankName(5, 5)).toBe("shortest");
    expect(rankName(5, 6)).toBe("5th longest");
    expect(rankName(6, 6)).toBe("shortest");
  });

  it("buckets 3-, 5- and 2-option questions by their own last rank", () => {
    const result = checkKeyLengths({
      file: FILE,
      text: file([
        { lengths: [70, 100, 90] },
        { lengths: [95, 100, 90] },
        { lengths: [92, 110, 100, 95, 90] },
        { lengths: [60, 100, 90, 80, 70] },
        { lengths: [95, 100] },
        { lengths: [100, 95] },
      ]),
    });
    expect(result.keyRanks).toEqual({
      shortest: 3,
      "2nd longest": 1,
      "4th longest": 1,
      longest: 1,
    });
  });
});
