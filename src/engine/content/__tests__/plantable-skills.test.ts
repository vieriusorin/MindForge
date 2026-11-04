import { describe, expect, it } from "vitest";
import type { Question } from "../../questions/types";
import { plantableSkills } from "../plantable-skills";
import { emptyReviewContext } from "../review";
import type { Diagram } from "../types";

const question = (id: string, skillCode: string): Question => ({
  id,
  skillCode,
  origin: "ai",
  stem: id,
  select: 1,
  options: [{ id: "A", text: "a", correct: true, rationale: "r" }],
  source: { title: "t", url: "https://example.com" },
});

const diagram = (id: string, skill: string): Diagram => ({
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

describe("plantableSkills", () => {
  it("keeps skills with a playable check or diagram, drops empty and fully flagged ones", () => {
    const review = emptyReviewContext();
    review.states.set("q-flagged", "flagged");
    const plantable = plantableSkills({
      content: {
        questions: [question("q1", "S1"), question("q-flagged", "S3")],
        cards: [],
        diagrams: [diagram("d1", "S2")],
      },
      review,
      skills: ["S1", "S2", "S3", "S4"],
    });
    expect([...plantable]).toEqual(["S1", "S2"]);
  });
});
