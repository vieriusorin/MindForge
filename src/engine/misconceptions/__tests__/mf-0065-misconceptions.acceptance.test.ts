/**
 * MF-0065 acceptance (SC-8 engine part, SC-9) — frozen. A pack's `misconceptions.yaml` (GOAL DQ-7) is
 * validated rule by rule; the tally (DQ-9, rows T1–T6), the lesson mix-up (DQ-12) and the confusable skills
 * (DQ-10, rows K1–K3) are pure functions over the learner's own attempts. Literals come from GOAL.md.
 */
import { describe, expect, it } from "vitest";
import { emptyReviewContext, type PackContent } from "@/engine/content";
import type { ForestView, TreeStage } from "@/engine/forest";
import { planLesson } from "@/engine/lesson";
import type { Attempt } from "@/engine/memory";
import {
  confusableSkills,
  lessonMixUp,
  misconceptionTally,
  type PackMisconceptions,
  parseMisconceptions,
} from "@/engine/misconceptions";
import { parsePack } from "@/engine/pack";
import type { Question } from "@/engine/questions";

const pack = parsePack(`
slug: p
name: P
kind: course
version: 1
domains:
  - code: D
    name: D
    weight: 100
    skills:
      - { code: S1, name: S1, weight: 40 }
      - { code: S2, name: S2, weight: 30 }
      - { code: S3, name: S3, weight: 30 }
`);

function question(id: string, skillCode: string, correct: string[]): Question {
  return {
    id,
    skillCode,
    origin: "ai",
    stem: `Stem ${id}`,
    select: correct.length,
    options: ["A", "B", "C", "D"].map((o) => ({
      id: o,
      text: `Option ${o}`,
      correct: correct.includes(o),
      rationale: `Because ${o}`,
    })),
    source: { title: "Doc", url: "https://example.com/doc" },
  };
}

const QUESTIONS: Question[] = [
  question("p.S1.q1", "S1", ["A"]),
  question("p.S1.q2", "S1", ["A", "B"]),
  question("p.S2.q1", "S2", ["A"]),
  question("p.S3.q1", "S3", ["A"]),
];

const VALID = `
misconceptions:
  - id: m-a
    label: "Mix A"
    skill: S2
  - id: m-b
    label: "Mix B"
    skill: S2
  - id: m-c
    label: "Mix C"
    skill: S3
  - id: m-self
    label: "Mix self"
    skill: S1
tags:
  p.S1.q1:
    B: m-a
    C: m-c
  p.S1.q2:
    C: m-b
    D: m-self
  p.S2.q1:
    B: m-a
`;

const parse = (text: string) =>
  parseMisconceptions({ file: "f.yaml", text, pack, questions: QUESTIONS });

describe("MF-0065 SC-8: parseMisconceptions", () => {
  it("SC-8: a valid file parses with no issue", () => {
    const { data, issues } = parse(VALID);
    expect(issues).toEqual([]);
    expect(data?.misconceptions.map((m) => m.id)).toEqual([
      "m-a",
      "m-b",
      "m-c",
      "m-self",
    ]);
    expect(data?.tags["p.S1.q1"]).toEqual({ B: "m-a", C: "m-c" });
  });

  const broken: [rule: string, text: string, expected: RegExp][] = [
    [
      "id is kebab-case",
      VALID.replace("id: m-self", "id: M_Self").replace(
        "D: m-self",
        "D: M_Self",
      ),
      /^f\.yaml: .*kebab-case/,
    ],
    [
      "ids are unique",
      VALID.replace("id: m-b", "id: m-a").replace("C: m-b", "C: m-a"),
      /^f\.yaml: .*duplicate misconception id "m-a"/,
    ],
    [
      "label is non-empty",
      VALID.replace('label: "Mix C"', 'label: ""'),
      /^f\.yaml: .*label/,
    ],
    [
      "skill is a skill of the pack",
      VALID.replace("skill: S3", "skill: S9"),
      /^f\.yaml: .*unknown skill "S9"/,
    ],
    [
      "a tagged question exists",
      VALID.replace("p.S2.q1:", "p.S2.q9:"),
      /^f\.yaml: .*unknown question "p\.S2\.q9"/,
    ],
    [
      "a tagged option exists",
      VALID.replace("B: m-a\n    C: m-c", "Z: m-a\n    C: m-c"),
      /^f\.yaml: .*unknown option "Z"/,
    ],
    [
      "a tagged option is a distractor",
      VALID.replace("B: m-a\n    C: m-c", "A: m-a\n    C: m-c"),
      /^f\.yaml: .*option "A" .*is correct/,
    ],
    [
      "a tag names a declared misconception",
      VALID.replace("    B: m-a\n    C: m-c", "    B: m-z\n    C: m-c"),
      /^f\.yaml: .*undeclared misconception "m-z"/,
    ],
    [
      "every misconception is used",
      VALID.replace("    C: m-c\n", ""),
      /^f\.yaml: .*misconception "m-c" is never used/,
    ],
  ];

  for (const [rule, text, expected] of broken) {
    it(`SC-8: one issue when broken: ${rule}`, () => {
      const { issues } = parse(text);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatch(expected);
    });
  }

  it("SC-8: unreadable YAML or an unknown key is an issue, never a skip", () => {
    expect(parse("misconceptions: [").issues.length).toBeGreaterThan(0);
    expect(parse(`${VALID}extra: 1\n`).issues.length).toBeGreaterThan(0);
  });
});

const DATA: PackMisconceptions = {
  misconceptions: [
    { id: "m-a", label: "Mix A", skill: "S2" },
    { id: "m-b", label: "Mix B", skill: "S2" },
    { id: "m-c", label: "Mix C", skill: "S3" },
    { id: "m-self", label: "Mix self", skill: "S1" },
  ],
  tags: {
    "p.S1.q1": { B: "m-a", C: "m-c" },
    "p.S1.q2": { C: "m-b", D: "m-self" },
    "p.S2.q1": { B: "m-a" },
  },
};

const T = (h: number): Date => new Date(Date.UTC(2026, 10, 1, h));
function picked(
  questionId: string,
  chosen: string[],
  correct: boolean,
  h: number,
): Attempt {
  return {
    questionId,
    skillCode: questionId.split(".")[1] ?? "",
    correct,
    answeredAt: T(h),
    chosen,
  };
}
const tally = (attempts: Attempt[]) =>
  misconceptionTally({ attempts, misconceptions: DATA }).map((c) => [
    c.misconceptionId,
    c.count,
  ]);

describe("MF-0065 SC-9: misconceptionTally", () => {
  it("SC-9 T1: no attempts, no tally", () => {
    expect(tally([])).toEqual([]);
  });

  it("SC-9 T2: a wrong pick of a tagged distractor counts once, with its label and time", () => {
    expect(
      misconceptionTally({
        attempts: [picked("p.S1.q1", ["B"], false, 1)],
        misconceptions: DATA,
      }),
    ).toEqual([
      { misconceptionId: "m-a", label: "Mix A", count: 1, lastPickedAt: T(1) },
    ]);
  });

  it("SC-9 T3: a correct attempt never counts", () => {
    expect(tally([picked("p.S1.q1", ["A"], true, 1)])).toEqual([]);
  });

  it("SC-9 T4: an untagged option counts nothing", () => {
    expect(tally([picked("p.S1.q1", ["D"], false, 1)])).toEqual([]);
    expect(tally([picked("p.S3.q1", ["B"], false, 1)])).toEqual([]);
  });

  it("SC-9 T5: a wrong multi-select pick counts each tagged option", () => {
    expect(tally([picked("p.S1.q2", ["C", "D"], false, 1)])).toEqual([
      ["m-b", 1],
      ["m-self", 1],
    ]);
  });

  it("SC-9 T6: by count, then the most recent pick", () => {
    expect(
      tally([
        picked("p.S1.q1", ["B"], false, 1), // m-a
        picked("p.S2.q1", ["B"], false, 2), // m-a
        picked("p.S1.q2", ["C", "A"], false, 3), // m-b
        picked("p.S1.q2", ["C", "B"], false, 5), // m-b (later)
        picked("p.S1.q1", ["C"], false, 4), // m-c
      ]),
    ).toEqual([
      ["m-b", 2],
      ["m-a", 2],
      ["m-c", 1],
    ]);
  });

  it("SC-9 / SC-12: lessonMixUp is the top misconception picked since the lesson began", () => {
    const attempts = [
      picked("p.S1.q1", ["C"], false, 1), // before the lesson
      picked("p.S1.q1", ["C"], false, 2), // before the lesson
      picked("p.S1.q1", ["B"], false, 4),
      picked("p.S2.q1", ["B"], false, 5),
    ];
    expect(
      lessonMixUp({ attempts, misconceptions: DATA, since: T(3) }),
    ).toEqual({ label: "Mix A", count: 2 });
    expect(
      lessonMixUp({ attempts, misconceptions: DATA, since: T(6) }),
    ).toBeNull();
  });
});

describe("MF-0065 SC-9: confusableSkills", () => {
  it("SC-9 K1: a skill without tags has none", () => {
    expect(
      confusableSkills({
        skillCode: "S3",
        misconceptions: DATA,
        questions: QUESTIONS,
      }),
    ).toEqual([]);
  });

  it("SC-9 K2: most tagged first, never the skill itself", () => {
    expect(
      confusableSkills({
        skillCode: "S1",
        misconceptions: DATA,
        questions: QUESTIONS,
      }),
    ).toEqual(["S2", "S3"]);
  });

  it("SC-9 K3: misconceptions without a skill link nothing", () => {
    const unlinked: PackMisconceptions = {
      misconceptions: DATA.misconceptions.map(({ id, label }) => ({
        id,
        label,
      })),
      tags: DATA.tags,
    };
    expect(
      confusableSkills({
        skillCode: "S1",
        misconceptions: unlinked,
        questions: QUESTIONS,
      }),
    ).toEqual([]);
  });
});

describe("MF-0065 SC-9: the lesson's confusable step prefers a linked skill", () => {
  const forest = (stages: Record<string, TreeStage>): ForestView => ({
    packSlug: "p",
    packName: "P",
    regions: [
      {
        domainCode: "D",
        name: "D",
        weight: 100,
        trees: ["S1", "S2", "S3", "S4"].map((code) => ({
          skillCode: code,
          name: code,
          weight: 10,
          stage: stages[code] ?? "seed",
          wilting: false,
        })),
      },
    ],
  });
  const content: PackContent = {
    questions: [
      question("p.S1.q1", "S1", ["A"]),
      question("p.S2.q1", "S2", ["A"]),
      question("p.S3.q1", "S3", ["A"]),
      question("p.S4.q1", "S4", ["A"]),
    ],
    cards: [],
    diagrams: [],
    cuckoos: [],
  };
  const input = {
    skillCode: "S4",
    forest: forest({ S1: "sprout", S2: "sapling", S3: "sprout", S4: "sprout" }),
    content,
    review: emptyReviewContext(),
    attempts: [],
  };

  it("SC-9: the first met linked skill becomes the confusable step", () => {
    expect(planLesson({ ...input, confusable: ["S1"] }).confusableSkill).toBe(
      "S1",
    );
  });

  it("SC-9: a linked Seed is skipped for the next linked met skill", () => {
    expect(
      planLesson({
        ...input,
        forest: forest({
          S1: "seed",
          S2: "sapling",
          S3: "sprout",
          S4: "sprout",
        }),
        confusable: ["S1", "S2"],
      }).confusableSkill,
    ).toBe("S2");
  });

  it("SC-9: no link (or none qualifies) keeps MF-0064's nearest earlier skill", () => {
    expect(planLesson(input).confusableSkill).toBe("S3");
    expect(
      planLesson({
        ...input,
        forest: forest({
          S1: "seed",
          S2: "sapling",
          S3: "sprout",
          S4: "sprout",
        }),
        confusable: ["S1"],
      }).confusableSkill,
    ).toBe("S3");
  });
});
