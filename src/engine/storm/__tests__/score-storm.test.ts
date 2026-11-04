import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadPackFile } from "../../pack/load-pack";
import type { Pack } from "../../pack/types";
import { scoreStorm } from "../score-storm";
import type { StormResultQuestion } from "../types";

let pack: Pack;
beforeAll(async () => {
  pack = await loadPackFile(
    join(__dirname, "../../../../packs/ccdv-f/pack.yaml"),
  );
});

const FINISHED = new Date("2026-11-20T10:00:00.000Z");
const answer = (
  id: string,
  skillCode: string,
  correct: boolean | null,
  voided = false,
): StormResultQuestion => ({
  id,
  skillCode,
  chosen: correct === null ? null : ["A"],
  correct,
  voided,
});

describe("scoreStorm", () => {
  it("floors the percent: 23 of 32 (71.875 %) is 71 and not survived", () => {
    const questions = Array.from({ length: 32 }, (_, i) =>
      answer(`q${i}`, "D2.S3", i < 23),
    );
    const report = scoreStorm(pack, {
      kind: "full",
      finishedAt: FINISHED,
      questions,
    });
    expect(report.domains).toEqual([
      {
        domainCode: "D2",
        scored: 32,
        correct: 23,
        percent: 71,
        survived: false,
      },
    ]);
  });

  it("leaves out a domain whose questions were all voided, and lists the voided ids in order", () => {
    const report = scoreStorm(pack, {
      kind: "boss",
      finishedAt: FINISHED,
      questions: [
        answer("q2", "D4.S1", null, true),
        answer("q1", "D1.S1", true),
        answer("q3", "D4.S1", null, true),
      ],
    });
    expect(report.domains.map((d) => d.domainCode)).toEqual(["D1"]);
    expect(report.skills.map((s) => s.skillCode)).toEqual(["D1.S1"]);
    expect(report.voided).toEqual(["q2", "q3"]);
  });

  it("counts an unanswered question as scored and wrong, so it blocks proof", () => {
    const report = scoreStorm(pack, {
      kind: "boss",
      finishedAt: FINISHED,
      questions: [answer("q1", "D1.S1", true), answer("q2", "D1.S1", null)],
    });
    expect(report.skills).toEqual([
      { skillCode: "D1.S1", scored: 2, correct: 1, proven: false },
    ]);
  });
});
