/**
 * MF-0013 acceptance (engine half): storm composition (SC-1, SC-2) and scoring (SC-5).
 * Expected counts are literals worked by hand from packs/ccdv-f/pack.yaml on 2026-11-04
 * (largest remainder by domain weight, then by skill weight inside a domain; GOAL.md).
 */
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { ReviewState } from "../../content/types";
import { loadPackFile } from "../../pack/load-pack";
import type { Pack } from "../../pack/types";
import { composeBossStorm, composeFullStorm } from "../compose-storm";
import { scoreStorm, stormDomainScores } from "../score-storm";
import type { StormCandidate, StormPlan, StormResultQuestion } from "../types";

const ROOT = join(__dirname, "../../../..");

let pack: Pack;
beforeAll(async () => {
  pack = await loadPackFile(join(ROOT, "packs/ccdv-f/pack.yaml"));
});

const FULL_DOMAINS = {
  D1: 8,
  D2: 17,
  D3: 2,
  D4: 1,
  D5: 9,
  D6: 6,
  D7: 4,
  D8: 6,
};

const FULL_SKILLS = {
  "D1.S1": 2,
  "D1.S2": 3,
  "D1.S3": 3,
  "D2.S1": 2,
  "D2.S2": 1,
  "D2.S3": 4,
  "D2.S4": 4,
  "D2.S5": 4,
  "D2.S6": 2,
  "D3.S1": 2,
  "D4.S1": 1,
  "D5.S1": 3,
  "D5.S2": 3,
  "D5.S3": 1,
  "D5.S4": 2,
  "D6.S1": 2,
  "D6.S2": 3,
  "D6.S3": 1,
  "D7.S1": 2,
  "D7.S2": 1,
  "D7.S3": 0,
  "D7.S4": 1,
  "D8.S1": 3,
  "D8.S2": 1,
  "D8.S3": 2,
};

function candidates(
  skillCode: string,
  count: number,
  over: Partial<StormCandidate> & { tag: string },
): StormCandidate[] {
  const { tag, ...rest } = over;
  return Array.from({ length: count }, (_, i) => ({
    id: `${skillCode}-${tag}${i + 1}`,
    skillCode,
    state: "approved" as ReviewState,
    spoiled: false,
    seenInStorm: false,
    ...rest,
  }));
}

function allSkills(): string[] {
  return pack.domains.flatMap((d) => d.skills.map((s) => s.code));
}

/** 10 clean approved candidates for every skill, except the skills overridden. */
function pool(
  overrides: Record<string, StormCandidate[]> = {},
): StormCandidate[] {
  return allSkills().flatMap(
    (code) => overrides[code] ?? candidates(code, 10, { tag: "a" }),
  );
}

function countBy(
  plan: StormPlan,
  key: "domainCode" | "skillCode",
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const q of plan.questions) out[q[key]] = (out[q[key]] ?? 0) + 1;
  return out;
}

const nonZero = (counts: Record<string, number>) =>
  Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0));

describe("MF-0013 storm composition", () => {
  it("SC-1: a Full Storm is 53 questions split by the blueprint, same seed → same storm", () => {
    const plan = composeFullStorm({ pack, pool: pool(), seed: 42 });

    expect(plan.kind).toBe("full");
    expect(plan.domainCode).toBeNull();
    expect(plan.durationSeconds).toBe(7200);
    expect(plan.questions).toHaveLength(53);
    expect(new Set(plan.questions.map((q) => q.id)).size).toBe(53);
    expect(countBy(plan, "domainCode")).toEqual(FULL_DOMAINS);
    expect(countBy(plan, "skillCode")).toEqual(nonZero(FULL_SKILLS));
    for (const q of plan.questions) {
      expect(q.skillCode.startsWith(`${q.domainCode}.`)).toBe(true);
      expect(q.unreviewed).toBe(false);
    }

    expect(composeFullStorm({ pack, pool: pool(), seed: 42 })).toEqual(plan);
  });

  it("SC-2: a short domain is filled from unreviewed (marked); flagged, rejected, spoiled never appear", () => {
    const plan = composeFullStorm({
      pack,
      seed: 7,
      pool: pool({
        "D3.S1": [
          ...candidates("D3.S1", 1, { tag: "a" }),
          ...candidates("D3.S1", 5, { tag: "u", state: "unreviewed" }),
          ...candidates("D3.S1", 3, { tag: "f", state: "flagged" }),
          ...candidates("D3.S1", 3, { tag: "r", state: "rejected" }),
          ...candidates("D3.S1", 3, { tag: "s", spoiled: true }),
        ],
      }),
    });

    const d3 = plan.questions.filter((q) => q.domainCode === "D3");
    expect(d3).toHaveLength(2);
    expect(d3.filter((q) => !q.unreviewed).map((q) => q.id)).toEqual([
      "D3.S1-a1",
    ]);
    const filled = d3.filter((q) => q.unreviewed);
    expect(filled).toHaveLength(1);
    expect(filled[0]?.id).toMatch(/^D3\.S1-u\d$/);
    expect(plan.questions).toHaveLength(53);
  });

  it("SC-2: a Boss Storm is 12 questions of one domain, 1631 s, split by skill weight", () => {
    const plan = composeBossStorm({
      pack,
      domainCode: "D2",
      pool: pool(),
      seed: 1,
    });

    expect(plan.kind).toBe("boss");
    expect(plan.domainCode).toBe("D2");
    expect(plan.durationSeconds).toBe(1631);
    expect(plan.questions).toHaveLength(12);
    expect(countBy(plan, "domainCode")).toEqual({ D2: 12 });
    expect(countBy(plan, "skillCode")).toEqual({
      "D2.S1": 1,
      "D2.S2": 1,
      "D2.S3": 2,
      "D2.S4": 3,
      "D2.S5": 3,
      "D2.S6": 2,
    });
  });

  it("SC-2: a Boss Storm with fewer playable questions takes all of them, and the clock shrinks", () => {
    const plan = composeBossStorm({
      pack,
      domainCode: "D4",
      seed: 3,
      pool: pool({
        "D4.S1": [
          ...candidates("D4.S1", 2, { tag: "a" }),
          ...candidates("D4.S1", 2, { tag: "u", state: "unreviewed" }),
          ...candidates("D4.S1", 3, { tag: "f", state: "flagged" }),
          ...candidates("D4.S1", 3, { tag: "r", state: "rejected" }),
          ...candidates("D4.S1", 3, { tag: "s", spoiled: true }),
          ...candidates("D4.S1", 3, {
            tag: "t",
            state: "unreviewed",
            spoiled: true,
          }),
        ],
      }),
    });

    expect(plan.questions.map((q) => q.id).sort()).toEqual([
      "D4.S1-a1",
      "D4.S1-a2",
      "D4.S1-u1",
      "D4.S1-u2",
    ]);
    expect(
      plan.questions
        .filter((q) => q.unreviewed)
        .map((q) => q.id)
        .sort(),
    ).toEqual(["D4.S1-u1", "D4.S1-u2"]);
    // ceil(4 × 7200 / 53) = ceil(543.40) = 544
    expect(plan.durationSeconds).toBe(544);
  });

  it("SC-2: questions from an earlier storm appear only when the pool is otherwise short", () => {
    const fresh = composeBossStorm({
      pack,
      domainCode: "D3",
      seed: 5,
      pool: pool({
        "D3.S1": [
          ...candidates("D3.S1", 12, { tag: "a" }),
          ...candidates("D3.S1", 5, { tag: "seen", seenInStorm: true }),
        ],
      }),
    });
    expect(fresh.questions.every((q) => !q.id.includes("seen"))).toBe(true);

    const short = composeBossStorm({
      pack,
      domainCode: "D3",
      seed: 5,
      pool: pool({
        "D3.S1": [
          ...candidates("D3.S1", 8, { tag: "a" }),
          ...candidates("D3.S1", 3, { tag: "u", state: "unreviewed" }),
          ...candidates("D3.S1", 5, { tag: "seen", seenInStorm: true }),
        ],
      }),
    });
    const ids = short.questions.map((q) => q.id);
    expect(ids).toHaveLength(12);
    expect(ids.filter((id) => /-a\d+$/.test(id))).toHaveLength(8);
    expect(ids.filter((id) => /-u\d+$/.test(id))).toHaveLength(3);
    expect(ids.filter((id) => id.includes("seen"))).toHaveLength(1);
  });
});

describe("MF-0013 storm scoring", () => {
  const FINISHED = new Date("2026-11-20T10:00:00.000Z");
  const q = (
    id: string,
    skillCode: string,
    outcome: "right" | "wrong" | "unanswered" | "voided",
  ): StormResultQuestion => ({
    id,
    skillCode,
    chosen: outcome === "unanswered" ? null : ["A"],
    correct: outcome === "right" ? true : outcome === "wrong" ? false : null,
    voided: outcome === "voided",
  });

  it("SC-5: per-domain %, survived ≥ 72, per-skill proven, StormDomainScore[]", () => {
    const report = scoreStorm(pack, {
      kind: "full",
      finishedAt: FINISHED,
      questions: [
        q("q1", "D1.S1", "right"),
        q("q2", "D1.S1", "right"),
        q("q3", "D1.S2", "right"),
        q("q4", "D1.S2", "unanswered"),
        q("q5", "D1.S3", "right"),
        q("q6", "D2.S1", "right"),
        q("q7", "D2.S1", "right"),
        q("q8", "D2.S1", "voided"),
        q("q9", "D2.S2", "wrong"),
        q("q10", "D2.S2", "wrong"),
        q("q11", "D3.S1", "right"),
        q("q12", "D3.S1", "right"),
        q("q13", "D3.S1", "right"),
        q("q14", "D3.S1", "wrong"),
      ],
    });

    expect(report.domains).toEqual([
      { domainCode: "D1", scored: 5, correct: 4, percent: 80, survived: true },
      { domainCode: "D2", scored: 4, correct: 2, percent: 50, survived: false },
      { domainCode: "D3", scored: 4, correct: 3, percent: 75, survived: true },
    ]);
    expect(report.skills).toEqual([
      { skillCode: "D1.S1", scored: 2, correct: 2, proven: true },
      { skillCode: "D1.S2", scored: 2, correct: 1, proven: false },
      { skillCode: "D1.S3", scored: 1, correct: 1, proven: false },
      { skillCode: "D2.S1", scored: 2, correct: 2, proven: true },
      { skillCode: "D2.S2", scored: 2, correct: 0, proven: false },
      { skillCode: "D3.S1", scored: 4, correct: 3, proven: false },
    ]);
    expect(report.voided).toEqual(["q8"]);

    expect(stormDomainScores(report)).toEqual([
      { domainCode: "D1", percent: 80, finishedAt: "2026-11-20T10:00:00.000Z" },
      { domainCode: "D2", percent: 50, finishedAt: "2026-11-20T10:00:00.000Z" },
      { domainCode: "D3", percent: 75, finishedAt: "2026-11-20T10:00:00.000Z" },
    ]);
  });
});
