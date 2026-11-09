/**
 * MF-0066 acceptance (frozen): SC-5, an order step joins a lesson only when the order is playable and its
 * diagram is approved; one per lesson, after the recalls and before the confusable step. Literals come from
 * GOAL.md SC-5 and the edge-input table.
 */
import { describe, expect, it } from "vitest";
import {
  type Diagram,
  emptyReviewContext,
  type NatureCard,
  type OrderItem,
  type ReviewContext,
  type ReviewState,
} from "@/engine/content";
import type { ForestView, TreeStage } from "@/engine/forest";
import {
  LESSON_STEP_KINDS,
  type LessonPlan,
  lessonSteps,
  type PlannedStep,
  planLesson,
} from "@/engine/lesson";
import type { Attempt } from "@/engine/memory";
import type { Question } from "@/engine/questions";

/** Pack order A1, A2 in one domain. */
function forest(stages: Record<string, TreeStage>): ForestView {
  const tree = (code: string) => ({
    skillCode: code,
    name: `Skill ${code}`,
    weight: 10,
    stage: stages[code] ?? "seed",
    wilting: false,
  });
  return {
    packSlug: "demo",
    packName: "Demo",
    regions: [
      {
        domainCode: "A",
        name: "A",
        weight: 100,
        trees: ["A1", "A2"].map(tree),
      },
    ],
  };
}

function question(id: string, skillCode: string): Question {
  return {
    id,
    skillCode,
    origin: "ai",
    stem: `Stem ${id}`,
    select: 1,
    options: ["A", "B", "C", "D"].map((o, i) => ({
      id: o,
      text: `Option ${o}`,
      correct: i === 0,
      rationale: `Because ${o}`,
    })),
    source: { title: "Doc", url: "https://example.com/doc" },
  };
}

const card: NatureCard = {
  id: "card-A2",
  skill: "A2",
  concept: "Concept",
  origin: "ai",
  simply: "Simply.",
  inNature: "In nature.",
  whereItBreaks: ["Breaks."],
  diagram: "diagram-A2",
  sources: ["https://example.com/doc"],
};

const diagram: Diagram = {
  id: "diagram-A2",
  skill: "A2",
  title: "Diagram A2",
  origin: "ai",
  direction: "LR",
  nodes: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
    { id: "c", label: "C" },
  ],
  edges: [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
  ],
  sources: ["https://example.com/doc"],
};

function order(id: string, skill = "A2"): OrderItem {
  return {
    id,
    skill,
    title: `Order ${id}`,
    origin: "ai",
    diagram: "diagram-A2",
    steps: [
      { node: "a", label: "A" },
      { node: "b", label: "B" },
      { node: "c", label: "C" },
    ],
    orderedBy: ["A, then B, then C."],
    explanation: "Because.",
    source: { title: "Doc", url: "https://example.com/doc" },
  };
}

function review(states: Record<string, ReviewState>): ReviewContext {
  const context = emptyReviewContext();
  for (const [id, state] of Object.entries(states)) {
    context.states.set(id, state);
    if (state === "rejected") context.rejected.add(id);
  }
  return context;
}

const T0 = new Date("2026-10-01T09:00:00Z").getTime();
const attempt = (
  questionId: string,
  correct: boolean,
  day: number,
): Attempt => ({
  questionId,
  skillCode: "A2",
  correct,
  answeredAt: new Date(T0 + day * 86_400_000),
});

interface Setup {
  orders?: OrderItem[];
  states?: Record<string, ReviewState>;
  stages?: Record<string, TreeStage>;
  withQuestions?: boolean;
  attempts?: Attempt[];
}

function plan({
  orders = [order("o1")],
  states = { "diagram-A2": "approved" },
  stages = { A1: "sprout", A2: "seed" },
  withQuestions = true,
  attempts = [],
}: Setup): LessonPlan {
  return planLesson({
    skillCode: "A2",
    forest: forest(stages),
    content: {
      questions: [
        question("A1.q1", "A1"),
        ...(withQuestions
          ? [question("A2.q1", "A2"), question("A2.q2", "A2")]
          : []),
      ],
      cards: [card],
      diagrams: [diagram],
      orders,
    },
    review: review(states),
    attempts,
  });
}

function label(step: PlannedStep): string {
  switch (step.kind) {
    case "card":
      return `card:${step.card.id}`;
    case "diagram":
      return `diagram:${step.diagram.id}`;
    case "order":
      return `order:${step.order.id}`;
    default:
      return `${step.kind}:${step.question.id}`;
  }
}

describe("MF-0066 SC-5: the order step in a lesson", () => {
  it("SC-5: 'order' is a lesson step kind", () => {
    expect(LESSON_STEP_KINDS).toContain("order");
  });

  it("SC-5: a servable order goes after the recalls, before the confusable step; it counts as an interaction", () => {
    const p = plan({});
    expect(p.order?.id).toBe("o1");
    expect(lessonSteps(p).map(label)).toEqual([
      "guess:A2.q1",
      "card:card-A2",
      "diagram:diagram-A2",
      "recall:A2.q1",
      "recall:A2.q2",
      "order:o1",
      "confusable:A1.q1",
    ]);
    expect(p.maxReasks).toBe(5);
  });

  it("SC-5: with no confusable step, the order step is last", () => {
    const p = plan({ stages: { A1: "seed", A2: "seed" } });
    expect(lessonSteps(p).map(label).slice(-2)).toEqual([
      "recall:A2.q2",
      "order:o1",
    ]);
  });

  it("SC-5: with no questions, the order follows the teach steps", () => {
    const p = plan({
      withQuestions: false,
      stages: { A1: "seed", A2: "seed" },
    });
    expect(lessonSteps(p).map(label)).toEqual([
      "card:card-A2",
      "diagram:diagram-A2",
      "order:o1",
    ]);
  });

  it.each<[string, Setup]>([
    ["the diagram is unreviewed", { states: {} }],
    ["the diagram is flagged", { states: { "diagram-A2": "flagged" } }],
    [
      "the order is flagged",
      { states: { "diagram-A2": "approved", o1: "flagged" } },
    ],
    [
      "the order is rejected",
      { states: { "diagram-A2": "approved", o1: "rejected" } },
    ],
    ["the only order is another skill's", { orders: [order("o9", "A1")] }],
    ["there are no orders", { orders: [] }],
  ])("SC-5: no order step when %s; the plan equals the plan without orders", (_name, setup) => {
    const p = plan(setup);
    const without = plan({ ...setup, orders: [] });
    expect(p.order).toBeNull();
    expect(lessonSteps(p)).toEqual(p.steps);
    expect(p).toEqual(without);
  });

  it("SC-5: an approved order on an approved diagram is served too", () => {
    expect(
      plan({ states: { "diagram-A2": "approved", o1: "approved" } }).order?.id,
    ).toBe("o1");
  });

  it("SC-5: of two servable orders, one step: wrong-last first, then never answered (file order), then least recent", () => {
    const both = [order("o1"), order("o2")];
    expect(plan({ orders: both }).order?.id).toBe("o1");
    expect(
      plan({ orders: both, attempts: [attempt("o1", true, 1)] }).order?.id,
    ).toBe("o2");
    expect(
      plan({
        orders: both,
        attempts: [attempt("o1", true, 1), attempt("o2", false, 2)],
      }).order?.id,
    ).toBe("o2");
    expect(
      plan({
        orders: both,
        attempts: [attempt("o1", true, 3), attempt("o2", true, 2)],
      }).order?.id,
    ).toBe("o2");
    expect(
      lessonSteps(plan({ orders: both })).filter((s) => s.kind === "order"),
    ).toHaveLength(1);
  });
});
