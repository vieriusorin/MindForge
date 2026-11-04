import { describe, expect, it } from "vitest";
import type { Question } from "../../questions/types";
import { playableQuestions } from "../playable-questions";
import { emptyReviewContext } from "../review";

const q = (id: string): Question => ({
  id,
  skillCode: "S",
  origin: "ai",
  stem: id,
  select: 1,
  options: [{ id: "A", text: "a", correct: true, rationale: "r" }],
  source: { title: "t", url: "https://example.com" },
});

describe("playableQuestions", () => {
  it("serves approved and unreviewed items in order, never flagged or rejected", () => {
    const review = emptyReviewContext();
    review.states.set("approved", "approved");
    review.states.set("flagged", "flagged");
    review.rejected.add("rejected");

    const served = playableQuestions(
      [q("unreviewed"), q("flagged"), q("approved"), q("rejected")],
      review,
      "practice",
    );
    expect(served.map((x) => x.id)).toEqual(["unreviewed", "approved"]);
  });
});
