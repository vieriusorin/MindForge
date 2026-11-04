import { describe, expect, it } from "vitest";
import {
  canSubmit,
  feedbackMessage,
  reasonLabel,
  toggleChoice,
} from "../utils";

describe("reasonLabel", () => {
  it("names why each skill is in the walk", () => {
    expect(reasonLabel("water")).toBe("Needs water");
    expect(reasonLabel("new")).toBe("New seed");
    expect(reasonLabel("strengthen")).toBe("Strengthen");
  });
});

describe("toggleChoice", () => {
  it("single-select replaces the pick", () => {
    expect(toggleChoice(["A"], "B", 1)).toEqual(["B"]);
  });
  it("multi-select adds and removes", () => {
    expect(toggleChoice(["A"], "B", 2)).toEqual(["A", "B"]);
    expect(toggleChoice(["A", "B"], "A", 2)).toEqual(["B"]);
  });
});

describe("canSubmit", () => {
  const base = {
    select: 2,
    chosenCount: 2,
    isAnswered: false,
    isPending: false,
  };
  it("needs exactly `select` picks", () => {
    expect(canSubmit(base)).toBe(true);
    expect(canSubmit({ ...base, chosenCount: 1 })).toBe(false);
    expect(canSubmit({ ...base, chosenCount: 3 })).toBe(false);
  });
  it("refuses once answered or while grading (no double attempt)", () => {
    expect(canSubmit({ ...base, isAnswered: true })).toBe(false);
    expect(canSubmit({ ...base, isPending: true })).toBe(false);
  });
});

describe("feedbackMessage", () => {
  it("says whether the answer was recalled", () => {
    expect(feedbackMessage(true)).toBe("Correct! Recalled and recorded.");
    expect(feedbackMessage(false)).toBe("Not quite. Read why, then carry on.");
  });
});
