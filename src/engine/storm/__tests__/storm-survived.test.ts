import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadPackFile } from "../../pack/load-pack";
import type { Pack } from "../../pack/types";
import { scoreStorm } from "../score-storm";
import { stormSurvived } from "../storm-survived";
import type { StormKind, StormResultQuestion } from "../types";

let pack: Pack;
beforeAll(async () => {
  pack = await loadPackFile(
    join(__dirname, "../../../../packs/ccdv-f/pack.yaml"),
  );
});

const FINISHED = new Date("2026-11-20T10:00:00.000Z");

/** `right` correct answers, then `wrong` wrong ones, then `unanswered` blanks, all on one skill. */
function answers(
  skillCode: string,
  counts: { right: number; wrong?: number; unanswered?: number },
): StormResultQuestion[] {
  const outcomes: (boolean | null)[] = [
    ...Array<boolean>(counts.right).fill(true),
    ...Array<boolean>(counts.wrong ?? 0).fill(false),
    ...Array<null>(counts.unanswered ?? 0).fill(null),
  ];
  return outcomes.map((correct, i) => ({
    id: `${skillCode}-q${i}`,
    skillCode,
    chosen: correct === null ? null : ["A"],
    correct,
    voided: false,
  }));
}

function verdict(kind: StormKind, questions: StormResultQuestion[]): boolean {
  return stormSurvived(
    scoreStorm(pack, { kind, finishedAt: FINISHED, questions }),
  );
}

describe("stormSurvived", () => {
  it("survives a Full Storm when every scored domain is at or above 72 %", () => {
    expect(
      verdict("full", [
        ...answers("D1.S1", { right: 4 }),
        ...answers("D2.S3", { right: 3, wrong: 1 }),
        ...answers("D4.S1", { right: 8, wrong: 2 }),
      ]),
    ).toBe(true);
  });
  it("does not survive when one domain is below 72 % (17 of 25 = 68 %)", () => {
    expect(
      verdict("full", [
        ...answers("D1.S1", { right: 4 }),
        ...answers("D2.S3", { right: 17, wrong: 8 }),
      ]),
    ).toBe(false);
  });

  it("survives a Boss Storm at exactly 72 % (18 of 25): the boundary is inclusive", () => {
    expect(verdict("boss", answers("D1.S1", { right: 18, wrong: 7 }))).toBe(
      true,
    );
  });

  it("does not survive a Boss Storm at 17 of 25 (68 %)", () => {
    expect(verdict("boss", answers("D1.S1", { right: 17, wrong: 8 }))).toBe(
      false,
    );
  });

  it("counts an unanswered question as wrong (2 right + 2 unanswered = 50 %)", () => {
    expect(verdict("boss", answers("D1.S1", { right: 2, unanswered: 2 }))).toBe(
      false,
    );
  });

  it("does not survive a storm with no scored domain (every question voided)", () => {
    const questions = answers("D4.S1", { right: 3 }).map((q) => ({
      ...q,
      voided: true,
    }));
    expect(verdict("boss", questions)).toBe(false);
  });
});
