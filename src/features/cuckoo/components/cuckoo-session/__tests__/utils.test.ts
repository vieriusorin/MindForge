import { describe, expect, it } from "vitest";
import {
  canCheck,
  isChoosable,
  lineState,
  nextLabel,
  verdictMessage,
} from "../utils";

const feedback = (correct: boolean) => ({
  correct,
  flawLine: 3,
  flawKind: "false-claim" as const,
  explanation: "e",
});

describe("cuckoo-session utils", () => {
  it("verdictMessage names the cuckoo's line when the pick was wrong", () => {
    expect(verdictMessage(feedback(true))).toBe(
      "Correct! You spotted the cuckoo.",
    );
    expect(verdictMessage(feedback(false))).toBe(
      "Not quite. The cuckoo was on line 3.",
    );
  });

  it("canCheck needs a picked line, no verdict yet, nothing in flight", () => {
    const base = { chosenLine: 2, isAnswered: false, isPending: false };
    expect(canCheck(base)).toBe(true);
    expect(canCheck({ ...base, chosenLine: null })).toBe(false);
    expect(canCheck({ ...base, isAnswered: true })).toBe(false);
    expect(canCheck({ ...base, isPending: true })).toBe(false);
  });

  it("lineState marks the cuckoo and a wrong pick only after grading", () => {
    expect(lineState(3, 1, null)).toBe("plain");
    expect(lineState(3, 1, feedback(false))).toBe("cuckoo");
    expect(lineState(1, 1, feedback(false))).toBe("missed");
    expect(lineState(2, 1, feedback(false))).toBe("plain");
    expect(lineState(3, 3, feedback(true))).toBe("cuckoo");
  });

  it("isChoosable leaves blank lines out", () => {
    expect(isChoosable("a: 1")).toBe(true);
    expect(isChoosable("")).toBe(false);
    expect(isChoosable("   ")).toBe(false);
  });

  it("nextLabel skips a refused snippet, else finishes on the last", () => {
    expect(nextLabel({ isRefused: true, isLast: false })).toBe(
      "Skip this snippet",
    );
    expect(nextLabel({ isRefused: true, isLast: true })).toBe(
      "Skip this snippet",
    );
    expect(nextLabel({ isRefused: false, isLast: true })).toBe("Finish");
    expect(nextLabel({ isRefused: false, isLast: false })).toBe("Next snippet");
  });
});
