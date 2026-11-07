import { describe, expect, it } from "vitest";
import { changeLine, reviewLine, scoreLine } from "../utils";

const seed = { stage: "seed", wilting: false } as const;
const sprout = { stage: "sprout", wilting: false } as const;

describe("lesson-close utils", () => {
  it("changeLine words each engine change", () => {
    expect(changeLine({ before: seed, after: sprout, change: "grew" })).toBe(
      "Seed → Sprout",
    );
    expect(
      changeLine({
        before: { stage: "sprout", wilting: true },
        after: sprout,
        change: "watered",
      }),
    ).toBe("Watered: Sprout");
    expect(
      changeLine({
        before: { stage: "sapling", wilting: false },
        after: sprout,
        change: "shrank",
      }),
    ).toBe("Back to Sprout");
    expect(changeLine({ before: seed, after: seed, change: "same" })).toBe(
      "Still a Seed",
    );
    const ancient = { stage: "ancient", wilting: false } as const;
    expect(
      changeLine({ before: ancient, after: ancient, change: "same" }),
    ).toBe("Still an Ancient tree");
  });

  it("scoreLine reads the engine counts", () => {
    expect(scoreLine({ answeredCount: 4, correctCount: 3 })).toBe(
      "3 of 4 correct",
    );
    expect(scoreLine({ answeredCount: 0, correctCount: 0 })).toBe(
      "0 of 0 correct",
    );
  });

  it("reviewLine shows the UTC day, or why there is none", () => {
    expect(
      reviewLine({
        after: sprout,
        nextReviewAt: new Date("2026-11-06T23:30:00.000Z"),
      }),
    ).toEqual({ text: "Next review: Nov 6, 2026", zone: "UTC" });
    expect(reviewLine({ after: seed, nextReviewAt: null })).toEqual({
      text: "No review date: a seed does not fade",
      zone: null,
    });
  });

  it("MF-0064 review: a fading tree never shows a past date, it says Review now", () => {
    expect(
      reviewLine({
        after: { stage: "sprout", wilting: true },
        nextReviewAt: new Date("2026-11-03T10:00:00.000Z"),
      }),
    ).toEqual({ text: "Review now: this tree is fading", zone: null });
  });
});
