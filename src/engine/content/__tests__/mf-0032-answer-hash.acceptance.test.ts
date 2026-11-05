/**
 * MF-0032 acceptance (SC-3, SC-4): an answer names the content hash the learner read. The app refuses
 * it before the database when the deployed file moved on, and the answer input requires the hash.
 * Expected values are literals from GOAL.md, never the output of the code.
 */
import { describe, expect, it } from "vitest";
import type { Question } from "@/engine/questions";
import { AnswerInput } from "@/lib/answer-input";
import { checkQuestionAnswer } from "..";

const QUESTION: Question = {
  id: "p.S1.q1",
  skillCode: "S1",
  origin: "official",
  stem: "Stem",
  select: 1,
  options: [
    { id: "A", text: "First", correct: false, rationale: "No" },
    { id: "B", text: "Second", correct: true, rationale: "Yes" },
  ],
  source: { title: "Docs", url: "https://example.com" },
};

describe("MF-0032 SC-3: checkQuestionAnswer", () => {
  it("SC-3: same hash on an approved question → ok", () => {
    expect(
      checkQuestionAnswer({
        question: QUESTION,
        reviewState: "approved",
        fileHash: "h1",
        sentHash: "h1",
      }),
    ).toEqual({ ok: true });
  });

  it("SC-3: the deployed file moved on → changed", () => {
    expect(
      checkQuestionAnswer({
        question: QUESTION,
        reviewState: "approved",
        fileHash: "h2",
        sentHash: "h1",
      }),
    ).toEqual({ ok: false, error: "changed" });
  });

  it("SC-3: no deployed hash for the question → changed (fail closed)", () => {
    expect(
      checkQuestionAnswer({
        question: QUESTION,
        reviewState: "approved",
        fileHash: undefined,
        sentHash: "h1",
      }),
    ).toEqual({ ok: false, error: "changed" });
  });

  it("SC-3: not in the pack → not-in-pack, before any other check", () => {
    expect(
      checkQuestionAnswer({
        question: null,
        reviewState: "rejected",
        fileHash: undefined,
        sentHash: "h1",
      }),
    ).toEqual({ ok: false, error: "not-in-pack" });
  });

  it("SC-3: flagged or rejected AND changed → withdrawn wins", () => {
    for (const reviewState of ["flagged", "rejected"] as const) {
      expect(
        checkQuestionAnswer({
          question: QUESTION,
          reviewState,
          fileHash: "h2",
          sentHash: "h1",
        }),
      ).toEqual({ ok: false, error: "withdrawn" });
    }
  });
});

describe("MF-0032 SC-4: AnswerInput carries the hash", () => {
  const base = { packSlug: "p", questionId: "p.S1.q1", chosen: ["B"] };

  it("SC-4: an answer with a hash parses and keeps it", () => {
    const parsed = AnswerInput.safeParse({ ...base, contentHash: "h1" });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ ...base, contentHash: "h1" });
  });

  it("SC-4: a missing, empty or over-long hash is refused", () => {
    expect(AnswerInput.safeParse(base).success).toBe(false);
    expect(AnswerInput.safeParse({ ...base, contentHash: "" }).success).toBe(
      false,
    );
    expect(
      AnswerInput.safeParse({ ...base, contentHash: "x".repeat(129) }).success,
    ).toBe(false);
  });
});
