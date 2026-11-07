/**
 * MF-0064 acceptance (SC-1, SC-2): the lesson plan for one skill. Rows and literals from the edge-input
 * tables in .planning/tasks/MF-0064/GOAL.md (L1–L12, R1–R4) and decisions D-L3..D-L8:
 * Seed = guess → card → diagram → recall × n → confusable; met skill = recall 1 → card → diagram →
 * recall 2..n → confusable; at most 6 recall items, at most 4 options, at most 12 interactions.
 */
import { describe, expect, it } from "vitest";
import {
  type Diagram,
  emptyReviewContext,
  type NatureCard,
  type ReviewContext,
} from "@/engine/content";
import type { ForestView, TreeStage } from "@/engine/forest";
import {
  type LessonPlan,
  type LessonStep,
  planLesson,
  reaskQuestionIds,
} from "@/engine/lesson";
import type { Attempt } from "@/engine/memory";
import type { Question } from "@/engine/questions";

interface TreeSpec {
  code: string;
  stage: TreeStage;
  wilting?: boolean;
}

/** Pack order A1, A2, A3 (domain A), B1 (domain B). */
function forest(stages: Record<string, TreeStage | TreeSpec>): ForestView {
  const spec = (code: string): TreeSpec => {
    const s = stages[code] ?? "seed";
    return typeof s === "string" ? { code, stage: s } : s;
  };
  const tree = (code: string) => {
    const s = spec(code);
    return {
      skillCode: code,
      name: `Skill ${code}`,
      weight: 10,
      stage: s.stage,
      wilting: s.wilting ?? false,
    };
  };
  return {
    packSlug: "demo",
    packName: "Demo",
    regions: [
      {
        domainCode: "A",
        name: "Domain A",
        weight: 60,
        trees: ["A1", "A2", "A3"].map(tree),
      },
      { domainCode: "B", name: "Domain B", weight: 40, trees: [tree("B1")] },
    ],
  };
}

function question(id: string, skillCode: string, optionCount = 4): Question {
  return {
    id,
    skillCode,
    origin: "ai",
    stem: `Stem ${id}`,
    select: 1,
    options: Array.from({ length: optionCount }, (_, i) => ({
      id: String.fromCharCode(65 + i),
      text: `Option ${i}`,
      correct: i === 0,
      rationale: `Because ${i}`,
    })),
    source: { title: "Doc", url: "https://example.com/doc" },
  };
}

function questions(skillCode: string, count: number): Question[] {
  return Array.from({ length: count }, (_, i) =>
    question(`${skillCode}.q${i + 1}`, skillCode),
  );
}

function card(skill: string): NatureCard {
  return {
    id: `card-${skill}`,
    skill,
    concept: `Concept ${skill}`,
    origin: "ai",
    simply: "Simply.",
    inNature: "In nature.",
    whereItBreaks: ["Breaks."],
    diagram: `diagram-${skill}`,
    sources: ["https://example.com/doc"],
  };
}

function diagram(skill: string): Diagram {
  return {
    id: `diagram-${skill}`,
    skill,
    title: `Diagram ${skill}`,
    origin: "ai",
    direction: "LR",
    nodes: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
    edges: [{ from: "a", to: "b" }],
    sources: ["https://example.com/doc"],
  };
}

const DAY = 86_400_000;
const T0 = new Date("2026-10-01T09:00:00Z").getTime();

function attempt(questionId: string, correct: boolean, day: number): Attempt {
  return {
    questionId,
    skillCode: questionId.split(".")[0] ?? "",
    correct,
    answeredAt: new Date(T0 + day * DAY),
  };
}

/** A step as a literal: kind plus the item it shows. */
function label(step: LessonStep): string {
  switch (step.kind) {
    case "card":
      return `card:${step.card.id}`;
    case "diagram":
      return `diagram:${step.diagram.id}`;
    case "guess":
    case "recall":
    case "confusable":
      return `${step.kind}:${step.question.id}`;
  }
}

interface Setup {
  target?: string;
  stages?: Record<string, TreeStage | TreeSpec>;
  targetQuestions?: Question[];
  hasCard?: boolean;
  hasDiagram?: boolean;
  attempts?: Attempt[];
  review?: ReviewContext;
}

function plan({
  target = "A2",
  stages = { A1: "sprout", A2: "seed" },
  targetQuestions = questions(target, 7),
  hasCard = true,
  hasDiagram = true,
  attempts = [],
  review = emptyReviewContext(),
}: Setup): LessonPlan {
  const others = ["A1", "A2", "A3", "B1"]
    .filter((s) => s !== target)
    .flatMap((s) => questions(s, 2));
  return planLesson({
    skillCode: target,
    forest: forest(stages),
    content: {
      questions: [...others, ...targetQuestions],
      cards: hasCard ? [card(target)] : [],
      diagrams: hasDiagram ? [diagram(target)] : [],
    },
    review,
    attempts,
  });
}

/** Built lazily so each case reports its own red (not a collection error). */
const l1Seed = (): LessonPlan => plan({});
const l2FadingSprout = (): LessonPlan =>
  plan({
    stages: {
      A1: "sprout",
      A2: { code: "A2", stage: "sprout", wilting: true },
    },
  });

describe("MF-0064 SC-1: planLesson (L1–L12)", () => {
  it("SC-1 L1: a Seed: guess, card, diagram, six recalls, one confusable", () => {
    expect(l1Seed().steps.map(label)).toEqual([
      "guess:A2.q1",
      "card:card-A2",
      "diagram:diagram-A2",
      "recall:A2.q1",
      "recall:A2.q2",
      "recall:A2.q3",
      "recall:A2.q4",
      "recall:A2.q5",
      "recall:A2.q6",
      "confusable:A1.q1",
    ]);
    expect(l1Seed().isNewSkill).toBe(true);
    expect(l1Seed().confusableSkill).toBe("A1");
    expect(l1Seed().maxReasks).toBe(2);
  });

  it("SC-1 L2: a fading Sprout starts with a graded recall, no guess", () => {
    expect(l2FadingSprout().steps.map(label)).toEqual([
      "recall:A2.q1",
      "card:card-A2",
      "diagram:diagram-A2",
      "recall:A2.q2",
      "recall:A2.q3",
      "recall:A2.q4",
      "recall:A2.q5",
      "recall:A2.q6",
      "confusable:A1.q1",
    ]);
    expect(l2FadingSprout().isNewSkill).toBe(false);
    expect(l2FadingSprout().maxReasks).toBe(3);
  });

  it("SC-1 L3: no diagram, no diagram step", () => {
    expect(plan({ hasDiagram: false }).steps.map((s) => s.kind)).toEqual([
      "guess",
      "card",
      "recall",
      "recall",
      "recall",
      "recall",
      "recall",
      "recall",
      "confusable",
    ]);
  });

  it("SC-1 L4: no card, no card step (the diagram still shows)", () => {
    expect(plan({ hasCard: false }).steps.map(label).slice(0, 3)).toEqual([
      "guess:A2.q1",
      "diagram:diagram-A2",
      "recall:A2.q1",
    ]);
    expect(plan({ hasCard: false }).steps.some((s) => s.kind === "card")).toBe(
      false,
    );
  });

  it("SC-1 L5: fewer items than the target gives a shorter lesson", () => {
    const p = plan({ targetQuestions: questions("A2", 2) });
    expect(p.steps.map(label)).toEqual([
      "guess:A2.q1",
      "card:card-A2",
      "diagram:diagram-A2",
      "recall:A2.q1",
      "recall:A2.q2",
      "confusable:A1.q1",
    ]);
    expect(p.maxReasks).toBe(6);
  });

  it("SC-1 L6: no confusable skill: the first skill, or every earlier skill a Seed", () => {
    const first = plan({ target: "A1", stages: { A1: "seed" } });
    expect(first.confusableSkill).toBeNull();
    expect(first.steps.some((s) => s.kind === "confusable")).toBe(false);
    const earlierSeeds = plan({ stages: { A1: "seed", A2: "seed" } });
    expect(earlierSeeds.confusableSkill).toBeNull();
    expect(earlierSeeds.steps.some((s) => s.kind === "confusable")).toBe(false);
  });

  it("SC-1 L7: every item already answered correctly: least recently answered first", () => {
    const p = plan({
      stages: { A1: "sprout", A2: "sapling" },
      // q1 answered most recently (day 7) … q7 longest ago (day 1).
      attempts: [1, 2, 3, 4, 5, 6, 7].map((n) =>
        attempt(`A2.q${n}`, true, 8 - n),
      ),
    });
    expect(p.steps.map(label)).toEqual([
      "recall:A2.q7",
      "card:card-A2",
      "diagram:diagram-A2",
      "recall:A2.q6",
      "recall:A2.q5",
      "recall:A2.q4",
      "recall:A2.q3",
      "recall:A2.q2",
      "confusable:A1.q1",
    ]);
  });

  it("SC-1 L8: last answered wrong first, then never answered, then least recently answered", () => {
    const p = plan({
      stages: { A1: "sprout", A2: "sprout" },
      attempts: [
        attempt("A2.q1", false, 0),
        attempt("A2.q1", true, 5),
        attempt("A2.q2", true, 1),
        attempt("A2.q3", true, 2),
        attempt("A2.q3", false, 6),
        attempt("A2.q4", true, 3),
        attempt("A2.q6", true, 2.5),
        attempt("A2.q7", true, 4),
      ],
    });
    expect(p.steps.filter((s) => s.kind === "recall").map(label)).toEqual([
      "recall:A2.q3",
      "recall:A2.q5",
      "recall:A2.q2",
      "recall:A2.q6",
      "recall:A2.q4",
      "recall:A2.q7",
    ]);
  });

  it("SC-1 L9: flagged, rejected and five-option items are never served", () => {
    const review = emptyReviewContext();
    review.states.set("A2.q2", "flagged");
    review.states.set("A2.q4", "rejected");
    review.rejected.add("A2.q4");
    const items = questions("A2", 7).map((q) =>
      q.id === "A2.q6" ? question("A2.q6", "A2", 5) : q,
    );
    const p = plan({ targetQuestions: items, review });
    expect(p.steps.map(label)).toEqual([
      "guess:A2.q1",
      "card:card-A2",
      "diagram:diagram-A2",
      "recall:A2.q1",
      "recall:A2.q3",
      "recall:A2.q5",
      "recall:A2.q7",
      "confusable:A1.q1",
    ]);
  });

  it("SC-1 L10: nothing to learn (no card, diagram or playable question): no steps", () => {
    const p = plan({ targetQuestions: [], hasCard: false, hasDiagram: false });
    expect(p.steps).toEqual([]);
  });

  it("SC-1 L11: the confusable is the nearest earlier skill already met, across a domain", () => {
    const p = plan({
      target: "B1",
      stages: { A1: "sprout", A2: "sprout", A3: "seed", B1: "seed" },
    });
    expect(p.confusableSkill).toBe("A2");
    expect(p.steps.at(-1)).toMatchObject({
      kind: "confusable",
      skillCode: "A2",
    });
    expect(p.steps.map(label).at(-1)).toBe("confusable:A2.q1");
  });

  it("SC-1 L12: a Seed gets a guess step, a fading Sprout does not", () => {
    expect(l1Seed().steps[0]?.kind).toBe("guess");
    expect(l2FadingSprout().steps.some((s) => s.kind === "guess")).toBe(false);
  });
});

const allPlans = (): readonly LessonPlan[] => [
  l1Seed(),
  l2FadingSprout(),
  plan({ hasDiagram: false }),
  plan({ hasCard: false }),
  plan({ targetQuestions: questions("A2", 2) }),
  plan({ target: "A1", stages: { A1: "seed" } }),
  plan({ target: "B1", stages: { A1: "sprout", A2: "sprout", A3: "seed" } }),
];

describe("MF-0064 SC-2: limits and re-asks", () => {
  it("SC-2: every question step has at most 4 options", () => {
    for (const p of allPlans()) {
      for (const s of p.steps) {
        if ("question" in s) {
          expect(s.question.options.length).toBeLessThanOrEqual(4);
        }
      }
    }
  });

  it("SC-2: planned steps plus re-asks never exceed 12 interactions", () => {
    for (const p of allPlans()) {
      expect(p.steps.length + p.maxReasks).toBeLessThanOrEqual(12);
      expect(p.maxReasks).toBeGreaterThanOrEqual(0);
    }
  });

  it("SC-2: at most 2 skills per lesson, and the confusable skill is never a Seed", () => {
    for (const p of allPlans()) {
      const skills = new Set(
        p.steps.flatMap((s) => ("question" in s ? [s.question.skillCode] : [])),
      );
      expect(skills.size).toBeLessThanOrEqual(2);
    }
    expect(l1Seed().confusableSkill).toBe("A1");
    const p = plan({ stages: { A1: "seed", A2: "seed" } });
    expect(p.confusableSkill).toBeNull();
  });

  it("SC-2: the guess item is the first recall item", () => {
    for (const p of allPlans()) {
      const guess = p.steps.find((s) => s.kind === "guess");
      if (!guess) continue;
      const firstRecall = p.steps.find((s) => s.kind === "recall");
      expect(firstRecall && "question" in firstRecall).toBe(true);
      if (guess.kind === "guess" && firstRecall?.kind === "recall") {
        expect(guess.question.id).toBe(firstRecall.question.id);
      }
    }
  });

  it("SC-2 R1: no misses, no re-asks", () => {
    expect(reaskQuestionIds({ plannedCount: 6, missedIds: [] })).toEqual([]);
  });

  it("SC-2 R2: re-asks keep the order missed, once each", () => {
    expect(
      reaskQuestionIds({ plannedCount: 6, missedIds: ["q3", "q1", "q3"] }),
    ).toEqual(["q3", "q1"]);
  });

  it("SC-2 R3: re-asks fill only what 12 interactions leave", () => {
    expect(
      reaskQuestionIds({
        plannedCount: 10,
        missedIds: ["q1", "q2", "q3", "q4"],
      }),
    ).toEqual(["q1", "q2"]);
  });

  it("SC-2 R4: a plan of 12 steps or more leaves no room for re-asks", () => {
    expect(reaskQuestionIds({ plannedCount: 12, missedIds: ["q1"] })).toEqual(
      [],
    );
    expect(reaskQuestionIds({ plannedCount: 13, missedIds: ["q1"] })).toEqual(
      [],
    );
  });
});
