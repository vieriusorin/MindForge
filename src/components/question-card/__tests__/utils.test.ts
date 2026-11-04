import { describe, expect, it } from "vitest";
import {
  canSubmit,
  feedbackMessage,
  optionState,
  originBadge,
  toggleChoice,
} from "../utils";

const feedback = {
  correct: false,
  correctOptionIds: ["B"],
  rationales: { A: "a", B: "b", C: "c" },
};

describe("optionState", () => {
  it("is plain for every option before grading", () => {
    expect(optionState("A", ["A"], null)).toBe("plain");
    expect(optionState("B", ["A"], null)).toBe("plain");
  });

  it("after grading marks the key, the wrong pick, and leaves the rest plain", () => {
    expect(optionState("B", ["A"], feedback)).toBe("key");
    expect(optionState("A", ["A"], feedback)).toBe("missed");
    expect(optionState("C", ["A"], feedback)).toBe("plain");
  });

  it("a chosen key is the key, not a miss", () => {
    expect(optionState("B", ["B"], { ...feedback, correct: true })).toBe("key");
  });
});

describe("originBadge", () => {
  it("vouches only for official items", () => {
    expect(originBadge("official")).toEqual({
      label: "Official sample",
      isOfficial: true,
    });
    expect(originBadge("ai")).toEqual({
      label: "Unreviewed",
      isOfficial: false,
    });
    expect(originBadge("human")).toEqual({
      label: "Unreviewed",
      isOfficial: false,
    });
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
