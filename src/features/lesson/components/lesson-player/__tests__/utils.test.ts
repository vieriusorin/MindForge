import { describe, expect, it } from "vitest";
import type { PlayableQuestion } from "@/engine/questions";
import type { PlayerStep } from "../../../types";
import {
  earnsReask,
  guessLine,
  isGradedStep,
  SEGMENT_VALUE,
  STEP_META,
  stepCountLine,
  stepMeta,
  withReasks,
} from "../utils";

function item(id: string): PlayableQuestion {
  return {
    id,
    skillCode: "S",
    origin: "ai",
    stem: id,
    select: 1,
    options: [{ id: "A", text: "a" }],
    source: { title: "t", url: "https://example.com" },
    contentHash: "h",
  };
}

const STEPS: PlayerStep[] = [
  { kind: "guess", question: item("q1") },
  { kind: "card" },
  { kind: "recall", question: item("q1") },
  { kind: "recall", question: item("q2") },
  { kind: "confusable", question: item("q9"), skillName: "Earlier" },
];

describe("lesson-player utils", () => {
  it("only recall, confusable and re-ask are graded; only the first two earn a re-ask", () => {
    expect(STEPS.map(isGradedStep)).toEqual([false, false, true, true, true]);
    expect(isGradedStep({ kind: "reask", question: item("q1") })).toBe(true);
    expect(earnsReask({ kind: "reask", question: item("q1") })).toBe(false);
    expect(earnsReask({ kind: "guess", question: item("q1") })).toBe(false);
    expect(
      earnsReask({ kind: "confusable", question: item("q9"), skillName: "E" }),
    ).toBe(true);
  });

  it("withReasks appends one re-ask per miss, in miss order, from the planned items", () => {
    const all = withReasks(STEPS, ["q9", "q2", "q9"]);
    expect(all.slice(5)).toEqual([
      { kind: "reask", question: item("q9") },
      { kind: "reask", question: item("q2") },
    ]);
    expect(withReasks(STEPS, [])).toEqual(STEPS);
    expect(withReasks(STEPS, ["unknown"])).toEqual(STEPS);
  });

  it("guessLine compares the guess with the key, ignoring order", () => {
    const feedback = {
      correct: true,
      correctOptionIds: ["B", "A"],
      rationales: {},
    };
    expect(guessLine(["A", "B"], feedback)).toBe(
      "Your guess before the lesson was right.",
    );
    expect(guessLine(["A"], feedback)).toBe(
      "Your guess before the lesson was not the answer.",
    );
    expect(guessLine(undefined, feedback)).toBeNull();
    expect(guessLine([], feedback)).toBeNull();
    expect(guessLine(["A"], null)).toBeNull();
  });

  it("stepMeta names the earlier skill on a confusable step", () => {
    expect(stepMeta(STEPS[4] as PlayerStep)).toBe(
      "From an earlier skill: Earlier",
    );
    expect(stepMeta({ kind: "reask", question: item("q1") })).toBe(
      STEP_META.reask,
    );
    expect(stepMeta({ kind: "card" })).toBe("Nature card");
  });

  it("stepCountLine and SEGMENT_VALUE", () => {
    expect(stepCountLine(3, 9)).toBe("Step 3 of 9");
    expect(SEGMENT_VALUE).toEqual({ done: 100, current: 50, todo: 0 });
  });
});
