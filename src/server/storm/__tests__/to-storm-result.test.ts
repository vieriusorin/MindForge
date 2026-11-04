import { describe, expect, it } from "vitest";
import { toStormResult } from "../to-storm-result";

describe("toStormResult", () => {
  it("maps a finished storm row and its questions to the engine's StormResult", () => {
    const result = toStormResult({
      kind: "boss",
      finished_at: "2026-11-04T10:00:00+00:00",
      storm_questions: [
        {
          position: 1,
          question_id: "q-1",
          skill_code: "1.1",
          chosen: ["A"],
          correct: true,
          voided: false,
        },
        {
          position: 2,
          question_id: "q-2",
          skill_code: "1.2",
          chosen: null,
          correct: null,
          voided: false,
        },
        {
          position: 3,
          question_id: "q-3",
          skill_code: "1.2",
          chosen: ["B"],
          correct: null,
          voided: true,
        },
      ],
    });
    expect(result.kind).toBe("boss");
    expect(result.finishedAt.toISOString()).toBe("2026-11-04T10:00:00.000Z");
    expect(result.questions).toEqual([
      {
        id: "q-1",
        skillCode: "1.1",
        chosen: ["A"],
        correct: true,
        voided: false,
      },
      {
        id: "q-2",
        skillCode: "1.2",
        chosen: null,
        correct: null,
        voided: false,
      },
      {
        id: "q-3",
        skillCode: "1.2",
        chosen: ["B"],
        correct: null,
        voided: true,
      },
    ]);
  });
});
