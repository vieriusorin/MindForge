import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadPackFile } from "../../pack/load-pack";
import type { Pack } from "../../pack/types";
import {
  BOSS_STORM_SIZE,
  composeBossStorm,
  composeFullStorm,
  stormDurationSeconds,
} from "../compose-storm";
import type { StormCandidate, StormPlan } from "../types";

let pack: Pack;
beforeAll(async () => {
  pack = await loadPackFile(
    join(__dirname, "../../../../packs/ccdv-f/pack.yaml"),
  );
});

function make(
  skillCode: string,
  count: number,
  tag: string,
  over: Partial<StormCandidate> = {},
): StormCandidate[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${skillCode}-${tag}${i + 1}`,
    skillCode,
    state: "approved",
    spoiled: false,
    seenInStorm: false,
    ...over,
  }));
}

const bySkill = (plan: StormPlan) => {
  const out: Record<string, number> = {};
  for (const q of plan.questions)
    out[q.skillCode] = (out[q.skillCode] ?? 0) + 1;
  return out;
};

describe("composeBossStorm seat passing", () => {
  it("passes a skill's seats to the other skills' approved questions before any unreviewed one", () => {
    const plan = composeBossStorm({
      pack,
      domainCode: "D1",
      seed: 11,
      pool: [
        ...make("D1.S1", 5, "u", { state: "unreviewed" }),
        ...make("D1.S2", 10, "a"),
        ...make("D1.S3", 10, "a"),
      ],
    });
    expect(plan.questions).toHaveLength(BOSS_STORM_SIZE);
    expect(plan.questions.some((q) => q.unreviewed)).toBe(false);
    expect(bySkill(plan)).toEqual({ "D1.S2": 6, "D1.S3": 6 });
  });

  it("fills a short skill from unreviewed once the domain's approved pool is spent", () => {
    const plan = composeBossStorm({
      pack,
      domainCode: "D1",
      seed: 11,
      pool: [
        ...make("D1.S1", 5, "u", { state: "unreviewed" }),
        ...make("D1.S2", 5, "a"),
        ...make("D1.S3", 5, "a"),
      ],
    });
    expect(bySkill(plan)).toEqual({ "D1.S1": 2, "D1.S2": 5, "D1.S3": 5 });
    expect(
      plan.questions.filter((q) => q.unreviewed).map((q) => q.skillCode),
    ).toEqual(["D1.S1", "D1.S1"]);
  });

  it("ignores candidates of other domains and of unknown skills", () => {
    const plan = composeBossStorm({
      pack,
      domainCode: "D4",
      seed: 2,
      pool: [
        ...make("D4.S1", 3, "a"),
        ...make("D2.S1", 9, "a"),
        ...make("X.S1", 9, "a"),
      ],
    });
    expect(plan.questions.map((q) => q.id).sort()).toEqual([
      "D4.S1-a1",
      "D4.S1-a2",
      "D4.S1-a3",
    ]);
  });

  it("throws on a domain the pack does not have", () => {
    expect(() =>
      composeBossStorm({ pack, domainCode: "D9", seed: 1, pool: [] }),
    ).toThrow(/D9/);
  });
});

describe("composeFullStorm", () => {
  it("makes the storm shorter when a domain is short even with unreviewed", () => {
    const pool = pack.domains.flatMap((d) =>
      d.skills.flatMap((s) => make(s.code, s.code === "D3.S1" ? 1 : 10, "a")),
    );
    const plan = composeFullStorm({ pack, pool, seed: 4 });
    expect(plan.questions).toHaveLength(52);
    expect(plan.durationSeconds).toBe(
      stormDurationSeconds({ questions: 53, minutes: 120 }, 52),
    );
  });

  it("throws for a pack without exam timing", () => {
    const { exam: _exam, ...noExam } = pack;
    expect(() => composeFullStorm({ pack: noExam, pool: [], seed: 1 })).toThrow(
      /exam/,
    );
    expect(() =>
      composeBossStorm({ pack: noExam, domainCode: "D1", pool: [], seed: 1 }),
    ).toThrow(/exam/);
  });
});

describe("stormDurationSeconds", () => {
  const exam = { questions: 53, minutes: 120 };
  it("scales the exam clock to the storm, rounded up", () => {
    expect(stormDurationSeconds(exam, 53)).toBe(7200);
    expect(stormDurationSeconds(exam, 12)).toBe(1631);
    expect(stormDurationSeconds(exam, 4)).toBe(544);
  });
});
