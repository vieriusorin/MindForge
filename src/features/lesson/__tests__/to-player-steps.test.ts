import { describe, expect, it } from "vitest";
import type { LessonStep } from "@/engine/lesson";
import type { Question } from "@/engine/questions";
import { toPlayerSteps } from "../utils/to-player-steps";

function q(id: string, skillCode = "S1"): Question {
  return {
    id,
    skillCode,
    origin: "ai",
    author: "someone@example.com",
    stem: id,
    select: 1,
    options: [{ id: "A", text: "a", correct: true, rationale: "secret" }],
    source: { title: "t", url: "https://example.com" },
  };
}

describe("toPlayerSteps", () => {
  it("binds each question to its deployed hash, strips the key, names the confusable skill", () => {
    const steps: LessonStep[] = [
      { kind: "guess", question: q("q1") },
      {
        kind: "diagram",
        diagram: {
          id: "d",
          skill: "S1",
          title: "D",
          origin: "ai",
          direction: "LR",
          nodes: [],
          edges: [],
          sources: [],
        },
      },
      { kind: "recall", question: q("q1") },
      { kind: "confusable", question: q("q9", "S0"), skillCode: "S0" },
    ];
    const out = toPlayerSteps({
      steps,
      hashes: { q1: "h1", q9: "h9" },
      skillNames: new Map([["S0", "Agent loops"]]),
      userId: "u1",
    });
    expect(out.map((s) => s.kind)).toEqual([
      "guess",
      "diagram",
      "recall",
      "confusable",
    ]);
    expect(out[0]).toEqual({
      kind: "guess",
      question: {
        id: "q1",
        skillCode: "S1",
        origin: "ai",
        stem: "q1",
        select: 1,
        options: [{ id: "A", text: "a" }],
        source: { title: "t", url: "https://example.com" },
        contentHash: "h1",
      },
    });
    expect(out[3]).toMatchObject({ skillName: "Agent loops" });
    expect(JSON.stringify(out)).not.toMatch(/secret|someone@/);
  });

  it("drops a question with no deployed hash (it could never be graded)", () => {
    const out = toPlayerSteps({
      steps: [
        { kind: "guess", question: q("q1") },
        { kind: "recall", question: q("q1") },
        { kind: "confusable", question: q("q9", "S0"), skillCode: "S0" },
      ],
      hashes: {},
      skillNames: new Map(),
      userId: "u1",
    });
    expect(out).toEqual([]);
  });
});
