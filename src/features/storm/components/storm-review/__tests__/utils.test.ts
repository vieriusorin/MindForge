import { describe, expect, it } from "vitest";
import { isMissVerdict, reviewVerdict } from "../utils";

describe("reviewVerdict", () => {
  it("a graded answer is Correct or Wrong", () => {
    expect(reviewVerdict({ chosen: ["A"], correct: true, voided: false })).toBe(
      "Correct",
    );
    expect(
      reviewVerdict({ chosen: ["A"], correct: false, voided: false }),
    ).toBe("Wrong");
  });

  it("no answer is Not answered", () => {
    expect(reviewVerdict({ chosen: [], correct: null, voided: false })).toBe(
      "Not answered",
    );
  });

  it("a voided question is Voided even when it was answered", () => {
    expect(reviewVerdict({ chosen: ["A"], correct: null, voided: true })).toBe(
      "Voided",
    );
  });
});

describe("isMissVerdict", () => {
  it("Wrong and Not answered are misses; Correct and Voided are not", () => {
    expect(isMissVerdict("Wrong")).toBe(true);
    expect(isMissVerdict("Not answered")).toBe(true);
    expect(isMissVerdict("Correct")).toBe(false);
    expect(isMissVerdict("Voided")).toBe(false);
  });
});
