import { describe, expect, it } from "vitest";
import type { ReviewContext } from "../../content/types";
import { buildForest } from "../../forest/build-forest";
import { countableAttempts } from "../../memory/countable";
import { memoryBySkill } from "../../memory/memory-by-skill";
import type { Attempt } from "../../memory/types";
import { parsePack } from "../../pack/load-pack";
import { stormProof } from "../../storm/storm-proof";
import type { StormResult } from "../../storm/types";
import { courseForest } from "../course-forest";

const pack = parsePack(`
slug: demo-course
name: Demo course
kind: course
version: 1
domains:
  - code: D1
    name: One
    weight: 100
    skills:
      - { code: D1.S1, name: First, weight: 50 }
      - { code: D1.S2, name: Second, weight: 50 }
`);

const NOW = new Date("2026-11-01T12:00:00.000Z");
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const ATTEMPTS: Attempt[] = [
  { questionId: "q1", skillCode: "D1.S1", correct: true, answeredAt: day(20) },
  { questionId: "q2", skillCode: "D1.S1", correct: true, answeredAt: day(12) },
  { questionId: "q3", skillCode: "D1.S1", correct: true, answeredAt: day(2) },
  {
    questionId: "rejected",
    skillCode: "D1.S2",
    correct: true,
    answeredAt: day(9),
  },
  {
    questionId: "spoiled",
    skillCode: "D1.S2",
    correct: true,
    answeredAt: day(1),
  },
];

const REVIEW: ReviewContext = {
  states: new Map(),
  rejected: new Set(["rejected"]),
  spoiledBy: new Set(["spoiled"]),
  spoiledAt: new Map([["spoiled", day(3)]]),
};

const STORMS: StormResult[] = [
  {
    kind: "boss",
    finishedAt: day(5),
    questions: [
      {
        id: "s1",
        skillCode: "D1.S1",
        chosen: ["a"],
        correct: true,
        voided: false,
      },
      {
        id: "s2",
        skillCode: "D1.S1",
        chosen: ["b"],
        correct: true,
        voided: false,
      },
    ],
  },
];

describe("courseForest", () => {
  it("equals Today's inline recipe (countable → storm proof → memory → forest)", () => {
    const inline = buildForest(
      pack,
      memoryBySkill(
        countableAttempts(ATTEMPTS, REVIEW),
        NOW,
        stormProof(STORMS, REVIEW.rejected),
      ),
    );
    expect(
      courseForest({
        pack,
        attempts: ATTEMPTS,
        review: REVIEW,
        stormResults: STORMS,
        now: NOW,
      }),
    ).toEqual(inline);
  });

  it("drops rejected and spoiled attempts, so that skill stays a seed", () => {
    const forest = courseForest({
      pack,
      attempts: ATTEMPTS,
      review: REVIEW,
      stormResults: [],
      now: NOW,
    });
    const [first, second] = forest.regions[0]?.trees ?? [];
    expect(first?.stage).not.toBe("seed");
    expect(second?.stage).toBe("seed");
  });

  it("is all seeds with no attempts", () => {
    const forest = courseForest({
      pack,
      attempts: [],
      review: REVIEW,
      stormResults: [],
      now: NOW,
    });
    expect(forest.regions[0]?.trees.map((t) => t.stage)).toEqual([
      "seed",
      "seed",
    ]);
  });
});
