/**
 * MF-0064 acceptance (SC-3): the next review date is the instant a tree starts to fade (D-L11).
 * ts-fsrs 5.4.2 probe (enable_fuzz false), recorded in GOAL F-3: one Good at 2026-11-01T10:00Z gives
 * S = 2.3065 d; get_retrievability floors elapsed days: R(+4 d) = 0.8580, below 0.85 from +5 d.
 * So the date is 2026-11-06T10:00:00.000Z, and `treeStage` flips to wilting at exactly that instant.
 */
import { describe, expect, it } from "vitest";
import { treeStage } from "@/engine/forest";
import { type Attempt, nextReviewAt, replayMemory } from "@/engine/memory";

const AT = new Date("2026-11-01T10:00:00.000Z");

function attempt(correct: boolean, at: Date, questionId = "q1"): Attempt {
  return { questionId, skillCode: "S1", correct, answeredAt: at };
}

describe("MF-0064 SC-3: nextReviewAt", () => {
  it("SC-3: one correct answer at 2026-11-01T10:00Z fades from 2026-11-06T10:00Z", () => {
    expect(nextReviewAt([attempt(true, AT)])?.toISOString()).toBe(
      "2026-11-06T10:00:00.000Z",
    );
  });

  it("SC-3: no attempts, or only wrong ones (a Seed), give no date", () => {
    expect(nextReviewAt([])).toBeNull();
    expect(
      nextReviewAt([
        attempt(false, AT),
        attempt(false, new Date("2026-11-02T10:00:00Z"), "q2"),
      ]),
    ).toBeNull();
  });

  it("SC-3: agrees with treeStage: not wilting 1 ms before, wilting at the instant", () => {
    const cases: Attempt[][] = [
      [attempt(true, AT)],
      [attempt(true, AT), attempt(true, new Date("2026-11-02T10:00:00Z"))],
      [
        attempt(true, AT),
        attempt(false, new Date("2026-11-03T08:30:00Z"), "q2"),
      ],
    ];
    for (const attempts of cases) {
      const at = nextReviewAt(attempts);
      expect(at).not.toBeNull();
      if (!at) continue;
      const before = replayMemory(attempts, new Date(at.getTime() - 1));
      const atInstant = replayMemory(attempts, at);
      expect(treeStage(before).wilting).toBe(false);
      expect(treeStage(atInstant).wilting).toBe(true);
    }
  });
});
