import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { treeStage } from "../../forest/tree-stage";
import { loadPackFile } from "../../pack/load-pack";
import { loadPackQuestions } from "../../questions/load-questions";
import { replayMemory } from "../replay";
import { pickSessionQuestions } from "../select";
import type { Attempt } from "../types";

const ROOT = process.cwd();
const day = (n: number): Date =>
  new Date(Date.UTC(2026, 10, 1) + n * 86_400_000);
const at = (d: number, correct: boolean): Attempt => ({
  questionId: "x.S1.q1",
  skillCode: "S1",
  correct,
  answeredAt: day(d),
});

describe("MF-0003 FSRS replay", () => {
  it("SC-3: memory comes only from graded attempts", () => {
    expect(replayMemory([], day(0))).toBeNull();

    const wrongOnly = replayMemory([at(0, false), at(1, false)], day(1));
    expect(wrongOnly?.successfulRecalls).toBe(0);
    expect(treeStage(wrongOnly).stage).toBe("seed");

    const once = [at(0, true)];
    expect(treeStage(replayMemory(once, day(0)))).toEqual({
      stage: "sprout",
      wilting: false,
    });
    expect(treeStage(replayMemory(once, day(60)))).toEqual({
      stage: "sprout",
      wilting: true,
    });

    const spaced = [at(25, true), at(0, true), at(10, true), at(3, true)]; // order must not matter
    const memory = replayMemory(spaced, day(25));
    expect(memory?.successfulRecalls).toBe(4);
    expect(memory?.stabilityDays).toBeGreaterThanOrEqual(3);
    expect(treeStage(memory).stage).toBe("sapling");
  });
});

describe("MF-0003 session selection", () => {
  it("SC-7: weight x (1 - R), distinct skills, learned skills drop below unseen ones", async () => {
    const pack = await loadPackFile(join(ROOT, "packs/ccdv-f/pack.yaml"));
    const questions = await loadPackQuestions(
      pack,
      join(ROOT, "packs/ccdv-f/questions"),
    );

    const fresh = pickSessionQuestions({
      pack,
      questions,
      attempts: [],
      now: day(0),
    });
    expect(fresh).toHaveLength(5);
    expect(new Set(fresh.map((q) => q.id)).size).toBe(5);
    expect(new Set(fresh.map((q) => q.skillCode)).size).toBe(5);
    expect(fresh[0]?.skillCode).toBe("D2.S5");

    const learned: Attempt[] = [
      {
        questionId: "ccdv-f.D2.S5.q1",
        skillCode: "D2.S5",
        correct: true,
        answeredAt: day(0),
      },
    ];
    const next = pickSessionQuestions({
      pack,
      questions,
      attempts: learned,
      now: day(0),
    });
    expect(next.map((q) => q.skillCode)).toEqual([
      "D2.S4",
      "D2.S3",
      "D5.S2",
      "D1.S2",
      "D5.S1",
    ]);
  });
});
