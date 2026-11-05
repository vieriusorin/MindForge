import { describe, expect, it } from "vitest";
import { toRecentStorm } from "../to-recent-storm";

describe("toRecentStorm", () => {
  it("maps a finished Boss Storm row to the camelCase DTO, keeping id and domain, finishedAt in toISOString form", () => {
    const storm = toRecentStorm({
      id: "storm-1",
      kind: "boss",
      domain_code: "D2",
      finished_at: "2026-11-04T10:00:00+00:00",
      storm_questions: [
        {
          position: 1,
          question_id: "q-1",
          skill_code: "D2.S1",
          chosen: ["A"],
          correct: true,
          voided: false,
        },
        {
          position: 2,
          question_id: "q-2",
          skill_code: "D2.S2",
          chosen: null,
          correct: null,
          voided: true,
        },
      ],
    });
    expect(storm).toEqual({
      id: "storm-1",
      kind: "boss",
      domainCode: "D2",
      finishedAt: "2026-11-04T10:00:00.000Z",
      questions: [
        {
          id: "q-1",
          skillCode: "D2.S1",
          chosen: ["A"],
          correct: true,
          voided: false,
        },
        {
          id: "q-2",
          skillCode: "D2.S2",
          chosen: null,
          correct: null,
          voided: true,
        },
      ],
    });
  });

  it("a Full Storm has no domain", () => {
    const storm = toRecentStorm({
      id: "storm-2",
      kind: "full",
      domain_code: null,
      finished_at: "2026-11-04T10:00:00+00:00",
      storm_questions: [],
    });
    expect(storm.domainCode).toBeNull();
    expect(storm.kind).toBe("full");
    expect(storm.questions).toEqual([]);
  });
});
