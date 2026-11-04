import { describe, expect, it } from "vitest";
import type { StormQuestionRow } from "@/server/storm/types";
import { toStormResultRow } from "../storm-result-row";

const row = (over: Partial<StormQuestionRow>): StormQuestionRow => ({
  questionId: "q1",
  skillCode: "D1.S1",
  domainCode: "D1",
  position: 1,
  contentHash: "h",
  unreviewed: false,
  chosen: ["A"],
  correct: true,
  voided: false,
  ...over,
});

describe("toStormResultRow", () => {
  it("carries kind, finish time and every graded question in order", () => {
    const result = toStormResultRow(
      { kind: "boss" },
      "2026-11-04T10:00:00.000Z",
      [
        row({}),
        row({
          questionId: "q2",
          position: 2,
          chosen: null,
          correct: null,
        }),
        row({ questionId: "q3", position: 3, voided: true, correct: null }),
      ],
    );
    expect(result).toEqual({
      kind: "boss",
      finished_at: "2026-11-04T10:00:00.000Z",
      storm_questions: [
        {
          position: 1,
          question_id: "q1",
          skill_code: "D1.S1",
          chosen: ["A"],
          correct: true,
          voided: false,
        },
        {
          position: 2,
          question_id: "q2",
          skill_code: "D1.S1",
          chosen: null,
          correct: null,
          voided: false,
        },
        {
          position: 3,
          question_id: "q3",
          skill_code: "D1.S1",
          chosen: ["A"],
          correct: null,
          voided: true,
        },
      ],
    });
  });

  it("drops the content hash and the unreviewed flag (not part of the score)", () => {
    const [q] = toStormResultRow({ kind: "full" }, "x", [
      row({}),
    ]).storm_questions;
    expect(q).not.toHaveProperty("content_hash");
    expect(q).not.toHaveProperty("unreviewed");
  });
});
