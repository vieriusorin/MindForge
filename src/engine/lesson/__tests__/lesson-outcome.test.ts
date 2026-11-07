import { describe, expect, it } from "vitest";
import { emptyReviewContext } from "@/engine/content";
import type { Pack } from "@/engine/pack";
import { lessonOutcome } from "../lesson-outcome";

const PACK: Pack = {
  slug: "p",
  name: "P",
  kind: "course",
  version: 1,
  domains: [
    {
      code: "D",
      name: "D",
      weight: 100,
      skills: [{ code: "S1", name: "S1", weight: 100 }],
    },
  ],
};

describe("lessonOutcome (inner)", () => {
  it("MF-0064 review: a fading tree with nothing answered since has a past date and after.wilting true", () => {
    const since = new Date("2026-11-07T10:00:00Z");
    const now = new Date("2026-11-07T10:05:00Z");
    const o = lessonOutcome({
      pack: PACK,
      attempts: [
        {
          questionId: "q1",
          skillCode: "S1",
          correct: true,
          answeredAt: new Date("2026-10-28T10:00:00Z"),
        },
      ],
      review: emptyReviewContext(),
      stormResults: [],
      skillCode: "S1",
      since,
      now,
    });
    const [skill] = o.skills;
    expect(skill?.after.wilting).toBe(true);
    expect(skill?.nextReviewAt?.getTime()).toBeLessThanOrEqual(now.getTime());
  });
});
