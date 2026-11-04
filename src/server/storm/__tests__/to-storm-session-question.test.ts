import { describe, expect, it } from "vitest";
import type { Question } from "@/engine/questions";
import { toStormSessionQuestion } from "../to-storm-session-question";
import type { StormQuestionRow } from "../types";

const question: Question = {
  id: "q-1",
  skillCode: "1.1",
  origin: "human",
  author: "someone@example.com",
  generatedBy: { model: "m", prompt: "p1" },
  stem: "Which?",
  select: 1,
  options: [
    { id: "A", text: "first", correct: true, rationale: "because" },
    { id: "B", text: "second", correct: false, rationale: "not this" },
  ],
  source: { title: "Docs", url: "https://example.com" },
};

const row: StormQuestionRow = {
  questionId: "q-1",
  skillCode: "1.1",
  domainCode: "D1",
  position: 1,
  contentHash: "hash-1",
  unreviewed: true,
  chosen: ["B"],
  correct: true,
  voided: false,
};

function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([k, v]) => [k, ...keysOf(v)]);
}

describe("toStormSessionQuestion", () => {
  it("SC-4: carries no key, rationale or authorship anywhere in its serialised form", () => {
    const serialised = JSON.parse(
      JSON.stringify(toStormSessionQuestion(question, row, "hash-1")),
    );
    const keys = keysOf(serialised);
    for (const forbidden of ["correct", "rationale", "author", "generatedBy"])
      expect(keys).not.toContain(forbidden);
    expect(JSON.stringify(serialised)).not.toMatch(/because|not this|someone@/);
  });

  it("carries what the session shows: the playable question, the read hash, the stored answer and the unreviewed label", () => {
    const out = toStormSessionQuestion(question, row, "hash-1");
    expect(out.question.id).toBe("q-1");
    expect(out.question.options).toEqual([
      { id: "A", text: "first" },
      { id: "B", text: "second" },
    ]);
    expect(out.contentHash).toBe("hash-1");
    expect(out.chosen).toEqual(["B"]);
    expect(out.unreviewed).toBe(true);
  });

  // MF-0013 review (blocking): the answer must name the version the learner READ, i.e. the deployed
  // file's hash, not the hash stored at start; otherwise the DB's "stored hash" check can never fail.
  it("names the deployed version's hash, not the one stored when the storm started", () => {
    const stored: StormQuestionRow = { ...row, contentHash: "stored-at-start" };
    const out = toStormSessionQuestion(question, stored, "deployed-now");
    expect(out.contentHash).toBe("deployed-now");
  });
});
