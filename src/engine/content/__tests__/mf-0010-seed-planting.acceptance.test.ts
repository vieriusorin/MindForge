import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPackFile } from "../../pack/load-pack";
import type { Question } from "../../questions/types";
import { loadPackContent } from "../load-content";
import { planSeedPlanting } from "../plan-seed-planting";
import { emptyReviewContext } from "../review";
import type {
  Diagram,
  NatureCard,
  PackContent,
  ReviewContext,
  ReviewState,
} from "../types";

// MF-0010 SC-6: choosing what to plant is one pure function.
// approved card > unreviewed card > none, ties by id, flagged/rejected never chosen;
// diagram from the card's link, else the skill's best playable diagram;
// ≤ 3 checks, approved first (then file order), never flagged/rejected.

const card = (id: string, skill = "S1", diagram?: string): NatureCard => ({
  id,
  skill,
  concept: id,
  origin: "human",
  simply: "s",
  inNature: "n",
  whereItBreaks: ["b"],
  diagram,
  sources: ["https://example.com"],
});

const diagram = (id: string, skill = "S1"): Diagram => ({
  id,
  skill,
  title: id,
  origin: "human",
  direction: "LR",
  nodes: [
    { id: "A", label: "a" },
    { id: "B", label: "b" },
  ],
  edges: [{ from: "A", to: "B" }],
  sources: ["https://example.com"],
});

const question = (id: string, skill = "S1"): Question => ({
  id,
  skillCode: skill,
  origin: "ai",
  stem: id,
  select: 1,
  options: [{ id: "A", text: "a", correct: true, rationale: "r" }],
  source: { title: "t", url: "https://example.com" },
});

const content = (parts: Partial<PackContent>): PackContent => ({
  questions: [],
  cards: [],
  diagrams: [],
  ...parts,
});

const reviewOf = (
  states: Record<string, Exclude<ReviewState, "rejected">>,
  rejected: string[] = [],
): ReviewContext => {
  const review = emptyReviewContext();
  for (const [id, state] of Object.entries(states))
    review.states.set(id, state);
  for (const id of rejected) review.rejected.add(id);
  return review;
};

describe("MF-0010 planSeedPlanting", () => {
  it("SC-6: an approved card beats an unreviewed one, even with a later id", () => {
    const plan = planSeedPlanting({
      content: content({ cards: [card("a-unreviewed"), card("z-approved")] }),
      review: reviewOf({ "z-approved": "approved" }),
      skill: "S1",
    });
    expect(plan.card?.id).toBe("z-approved");
  });

  it("SC-6: among cards of the same state the smallest id wins", () => {
    const plan = planSeedPlanting({
      content: content({ cards: [card("c2"), card("c1"), card("c3")] }),
      review: emptyReviewContext(),
      skill: "S1",
    });
    expect(plan.card?.id).toBe("c1");
  });

  it("SC-6: flagged and rejected cards are never chosen; with only those, there is no card", () => {
    const plan = planSeedPlanting({
      content: content({ cards: [card("a-flagged"), card("b-rejected")] }),
      review: reviewOf({ "a-flagged": "flagged" }, ["b-rejected"]),
      skill: "S1",
    });
    expect(plan.card).toBeNull();
  });

  it("SC-6: only the requested skill's items are considered", () => {
    const plan = planSeedPlanting({
      content: content({
        cards: [card("other", "S2")],
        diagrams: [diagram("other-d", "S2")],
        questions: [question("other-q", "S2")],
      }),
      review: emptyReviewContext(),
      skill: "S1",
    });
    expect(plan).toEqual({ card: null, diagram: null, checks: [] });
  });

  it("SC-6: the diagram is the one the chosen card links to", () => {
    const plan = planSeedPlanting({
      content: content({
        cards: [card("c1", "S1", "d-linked")],
        diagrams: [diagram("d-approved"), diagram("d-linked")],
      }),
      review: reviewOf({ "d-approved": "approved" }),
      skill: "S1",
    });
    expect(plan.diagram?.id).toBe("d-linked");
  });

  it("SC-6: a card's flagged diagram falls back to the skill's best playable diagram", () => {
    const plan = planSeedPlanting({
      content: content({
        cards: [card("c1", "S1", "d-flagged")],
        diagrams: [
          diagram("d-flagged"),
          diagram("d-b-unreviewed"),
          diagram("d-a-unreviewed"),
        ],
      }),
      review: reviewOf({ "d-flagged": "flagged" }),
      skill: "S1",
    });
    expect(plan.diagram?.id).toBe("d-a-unreviewed");
  });

  it("SC-6: a skill without a card still gets its diagram, approved first", () => {
    const plan = planSeedPlanting({
      content: content({
        diagrams: [diagram("d-a"), diagram("d-z-approved")],
      }),
      review: reviewOf({ "d-z-approved": "approved" }),
      skill: "S1",
    });
    expect(plan.card).toBeNull();
    expect(plan.diagram?.id).toBe("d-z-approved");
  });

  it("SC-6: at most 3 checks, approved first then file order, never flagged or rejected", () => {
    const plan = planSeedPlanting({
      content: content({
        questions: [
          question("q1"),
          question("q2-flagged"),
          question("q3"),
          question("q4-approved"),
          question("q5-rejected"),
          question("q6"),
        ],
      }),
      review: reviewOf({ "q2-flagged": "flagged", "q4-approved": "approved" }, [
        "q5-rejected",
      ]),
      skill: "S1",
    });
    expect(plan.checks.map((q) => q.id)).toEqual(["q4-approved", "q1", "q3"]);
  });

  it("SC-6 (C-3): a skill with 2 playable questions gets 2 checks, no padding", () => {
    const plan = planSeedPlanting({
      content: content({
        questions: [question("q1"), question("q2"), question("x", "S2")],
      }),
      review: emptyReviewContext(),
      skill: "S1",
    });
    expect(plan.checks.map((q) => q.id)).toEqual(["q1", "q2"]);
  });

  it("SC-6 / SC-1: D5.S1 in the real pack plants the Temperature card, its diagram and 2 checks", async () => {
    const root = process.cwd();
    const pack = await loadPackFile(join(root, "packs/ccdv-f/pack.yaml"));
    const real = await loadPackContent(pack, join(root, "packs/ccdv-f"));
    const plan = planSeedPlanting({
      content: real,
      review: emptyReviewContext(),
      skill: "D5.S1",
    });
    expect(plan.card?.id).toBe("ccdv-f.D5.S1.card-temperature");
    expect(plan.diagram?.id).toBe("ccdv-f.D5.S1.diagram-temperature");
    expect(plan.checks).toHaveLength(2);
    expect(plan.checks.every((q) => q.skillCode === "D5.S1")).toBe(true);
  });

  it("SC-6: D1.S3 in the real pack has no card and still plants its diagram", async () => {
    const root = process.cwd();
    const pack = await loadPackFile(join(root, "packs/ccdv-f/pack.yaml"));
    const real = await loadPackContent(pack, join(root, "packs/ccdv-f"));
    const plan = planSeedPlanting({
      content: real,
      review: emptyReviewContext(),
      skill: "D1.S3",
    });
    expect(plan.card).toBeNull();
    expect(plan.diagram?.skill).toBe("D1.S3");
  });
});
