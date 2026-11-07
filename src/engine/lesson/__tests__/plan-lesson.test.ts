import { describe, expect, it } from "vitest";
import { emptyReviewContext } from "@/engine/content";
import type { ForestView } from "@/engine/forest";
import type { Question } from "@/engine/questions";
import { planLesson } from "../plan-lesson";

const FOREST: ForestView = {
  packSlug: "p",
  packName: "P",
  regions: [
    {
      domainCode: "D",
      name: "D",
      weight: 100,
      trees: [
        {
          skillCode: "S1",
          name: "S1",
          weight: 50,
          stage: "sprout",
          wilting: false,
        },
        {
          skillCode: "S2",
          name: "S2",
          weight: 50,
          stage: "seed",
          wilting: false,
        },
      ],
    },
  ],
};

function q(id: string, skillCode: string): Question {
  return {
    id,
    skillCode,
    origin: "ai",
    stem: id,
    select: 1,
    options: ["A", "B"].map((o, i) => ({
      id: o,
      text: o,
      correct: i === 0,
      rationale: o,
    })),
    source: { title: "t", url: "https://example.com" },
  };
}

describe("planLesson (inner)", () => {
  it("two items last answered wrong: the longer-ago miss comes first", () => {
    const plan = planLesson({
      skillCode: "S1",
      forest: FOREST,
      content: {
        questions: [q("a", "S1"), q("b", "S1")],
        cards: [],
        diagrams: [],
      },
      review: emptyReviewContext(),
      attempts: [
        {
          questionId: "a",
          skillCode: "S1",
          correct: false,
          answeredAt: new Date("2026-11-05T00:00:00Z"),
        },
        {
          questionId: "b",
          skillCode: "S1",
          correct: false,
          answeredAt: new Date("2026-11-01T00:00:00Z"),
        },
      ],
    });
    expect(
      plan.steps.map((s) => ("question" in s ? s.question.id : s.kind)),
    ).toEqual(["b", "a"]);
  });

  it("a skill absent from the forest is treated as a Seed", () => {
    const plan = planLesson({
      skillCode: "X",
      forest: FOREST,
      content: { questions: [q("x", "X")], cards: [], diagrams: [] },
      review: emptyReviewContext(),
      attempts: [],
    });
    expect(plan.isNewSkill).toBe(true);
    expect(plan.confusableSkill).toBeNull();
  });

  it("a confusable skill with no servable item is skipped for an earlier one", () => {
    const forest: ForestView = {
      ...FOREST,
      regions: [
        {
          ...(FOREST.regions[0] as ForestView["regions"][number]),
          trees: [
            {
              skillCode: "S0",
              name: "S0",
              weight: 10,
              stage: "sapling",
              wilting: false,
            },
            {
              skillCode: "S1",
              name: "S1",
              weight: 10,
              stage: "sprout",
              wilting: false,
            },
            {
              skillCode: "S2",
              name: "S2",
              weight: 10,
              stage: "seed",
              wilting: false,
            },
          ],
        },
      ],
    };
    const plan = planLesson({
      skillCode: "S2",
      forest,
      content: {
        questions: [q("s0", "S0"), q("s2", "S2")],
        cards: [],
        diagrams: [],
      },
      review: emptyReviewContext(),
      attempts: [],
    });
    expect(plan.confusableSkill).toBe("S0");
  });
});
