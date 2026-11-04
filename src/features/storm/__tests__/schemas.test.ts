import { describe, expect, it } from "vitest";
import { AnswerStormInput } from "../schemas";

const base = {
  stormId: "6f1c1c1e-8a52-4a8e-9a39-1c1d2f3b4a5c",
  questionId: "q1",
  contentHash: "hash-q1",
};

describe("AnswerStormInput", () => {
  it("accepts an empty pick, which clears the stored answer", () => {
    expect(AnswerStormInput.safeParse({ ...base, chosen: [] }).success).toBe(
      true,
    );
  });

  it("accepts up to ten single-letter option ids", () => {
    expect(
      AnswerStormInput.safeParse({ ...base, chosen: ["A", "B"] }).success,
    ).toBe(true);
  });

  it("refuses more than ten picks or a non-letter id", () => {
    const eleven = "ABCDEFGHIJK".split("");
    expect(
      AnswerStormInput.safeParse({ ...base, chosen: eleven }).success,
    ).toBe(false);
    expect(
      AnswerStormInput.safeParse({ ...base, chosen: ["ab"] }).success,
    ).toBe(false);
  });
});
