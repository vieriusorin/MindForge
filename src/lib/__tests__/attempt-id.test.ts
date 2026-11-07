import { describe, expect, it } from "vitest";
import { AnswerInput } from "../answer-input";
import { attemptIdFor, submissionKey } from "../attempt-id";

function counter(): () => string {
  let n = 0;
  return () => `id-${++n}`;
}

describe("attemptIdFor (MF-0067)", () => {
  it("mints an id for the first submission", () => {
    expect(
      attemptIdFor({ held: null, submission: "s1", mint: counter() }),
    ).toEqual({ submission: "s1", id: "id-1" });
  });

  it("keeps the held id for a retry of the same submission", () => {
    const mint = counter();
    const first = attemptIdFor({ held: null, submission: "s1", mint });
    expect(attemptIdFor({ held: first, submission: "s1", mint })).toEqual({
      submission: "s1",
      id: "id-1",
    });
  });

  it("mints a new id for another submission", () => {
    const mint = counter();
    const first = attemptIdFor({ held: null, submission: "s1", mint });
    expect(attemptIdFor({ held: first, submission: "s2", mint })).toEqual({
      submission: "s2",
      id: "id-2",
    });
  });
});

describe("submissionKey (MF-0067)", () => {
  it("is equal for the same item and answer", () => {
    expect(submissionKey("q1", ["B"])).toBe(submissionKey("q1", ["B"]));
    expect(submissionKey("c1", 3)).toBe(submissionKey("c1", 3));
  });

  it("differs when the item or the answer differs", () => {
    expect(submissionKey("q1", ["B"])).not.toBe(submissionKey("q2", ["B"]));
    expect(submissionKey("q1", ["B"])).not.toBe(submissionKey("q1", ["A"]));
    expect(submissionKey("q1", ["A", "B"])).not.toBe(
      submissionKey("q1", ["B", "A"]),
    );
    expect(submissionKey("c1", 3)).not.toBe(submissionKey("c1", 2));
  });

  it("cannot be forged by an id that contains the separator", () => {
    expect(submissionKey("q1,B", [])).not.toBe(submissionKey("q1", ["B"]));
  });
});

describe("the minted id meets the input contract (MF-0067)", () => {
  it("crypto.randomUUID() passes AnswerInput.clientAttemptId (z.uuid)", () => {
    for (let i = 0; i < 50; i++) {
      const parsed = AnswerInput.safeParse({
        packSlug: "p",
        questionId: "p.S1.q1",
        chosen: ["B"],
        contentHash: "h1",
        clientAttemptId: crypto.randomUUID(),
      });
      expect(parsed.success).toBe(true);
    }
  });
});

describe("submissionKey with a confidence tap (MF-0065)", () => {
  it("no tap keeps the MF-0067 key", () => {
    expect(submissionKey("q1", ["B"], null)).toBe(submissionKey("q1", ["B"]));
  });
  it("a different tap is a different submission", () => {
    expect(submissionKey("q1", ["B"], "sure")).not.toBe(
      submissionKey("q1", ["B"], "unsure"),
    );
    expect(submissionKey("q1", ["B"], "sure")).not.toBe(
      submissionKey("q1", ["B"]),
    );
  });
});
