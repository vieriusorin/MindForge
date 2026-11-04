import { describe, expect, it } from "vitest";
import { outcomeCopy, plantingOutcome } from "../utils";

describe("plantingOutcome", () => {
  it("a seed with at least one correct check sprouts", () => {
    expect(plantingOutcome({ wasSeed: true, correctCount: 1 })).toBe(
      "sprouted",
    );
    expect(plantingOutcome({ wasSeed: true, correctCount: 3 })).toBe(
      "sprouted",
    );
  });
  it("a seed with no correct check stays a seed", () => {
    expect(plantingOutcome({ wasSeed: true, correctCount: 0 })).toBe(
      "still-seed",
    );
  });
  it("a tree that was already growing only records the answers", () => {
    expect(plantingOutcome({ wasSeed: false, correctCount: 2 })).toBe(
      "recorded",
    );
    expect(plantingOutcome({ wasSeed: false, correctCount: 0 })).toBe(
      "recorded",
    );
  });
});

describe("outcomeCopy", () => {
  it("names each outcome", () => {
    expect(outcomeCopy("sprouted").title).toBe("Your seed sprouted");
    expect(outcomeCopy("still-seed").title).toBe("Still a seed");
    expect(outcomeCopy("recorded").title).toBe("Checks done");
  });
});
