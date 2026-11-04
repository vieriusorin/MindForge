import { describe, expect, it } from "vitest";
import type { Question } from "@/engine/questions";
import { reviewFeedback } from "../review-feedback";

const QUESTION: Question = {
  id: "p.S1.1",
  skillCode: "S1",
  origin: "ai",
  stem: "Stem",
  select: 2,
  options: [
    { id: "A", text: "a", correct: true, rationale: "A is right" },
    { id: "B", text: "b", correct: false, rationale: "B is wrong" },
    { id: "C", text: "c", correct: true, rationale: "C is right" },
  ],
  source: { title: "Docs", url: "https://example.com" },
};

describe("reviewFeedback", () => {
  it("reveals every key option and every rationale", () => {
    expect(reviewFeedback(QUESTION, true)).toEqual({
      correct: true,
      correctOptionIds: ["A", "C"],
      rationales: { A: "A is right", B: "B is wrong", C: "C is right" },
    });
  });

  it("a wrong answer is not correct", () => {
    expect(reviewFeedback(QUESTION, false).correct).toBe(false);
  });

  it("an unanswered or voided question (null grade) is not correct", () => {
    expect(reviewFeedback(QUESTION, null).correct).toBe(false);
  });
});
