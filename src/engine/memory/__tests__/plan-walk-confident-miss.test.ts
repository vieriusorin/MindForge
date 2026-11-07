import { describe, expect, it } from "vitest";
import { parsePack } from "../../pack/load-pack";
import type { Question } from "../../questions/types";
import { planWalk, WALK_SIZE } from "../plan-walk";
import type { Attempt } from "../types";

// MF-0065 review should-fix 1: a confident miss always makes the Daily Walk, even when more than WALK_SIZE skills
// need water (its R is ~1 right after the lapse, so ranking it by weight × (1 − R) put it last and the cut dropped it).

const DAY = 86_400_000;
const NOW = new Date("2026-11-21T11:00:00.000Z");
const SKILLS = Array.from({ length: 13 }, (_, i) => `S${i + 1}`);
const pack = parsePack(`
slug: p
name: P
kind: course
version: 1
domains:
  - code: D
    name: D
    weight: 100
    skills:
${SKILLS.map((c) => `      - { code: ${c}, name: ${c}, weight: ${c === "S13" ? 16 : 7} }`).join("\n")}
`);
const q = (skillCode: string): Question => ({
  id: `p.${skillCode}.q1`,
  skillCode,
  origin: "ai",
  author: "author@example.com",
  stem: skillCode,
  select: 1,
  options: [
    { id: "A", text: "a", correct: true, rationale: "r" },
    { id: "B", text: "b", correct: false, rationale: "r" },
  ],
  source: { title: "t", url: "https://example.com" },
});
const at = (
  skillCode: string,
  daysAgo: number,
  correct: boolean,
  confidence?: "sure",
): Attempt => ({
  questionId: `p.${skillCode}.q1`,
  skillCode,
  correct,
  answeredAt: new Date(NOW.getTime() - daysAgo * DAY),
  ...(confidence ? { confidence } : {}),
});

describe("planWalk with a confident miss and a full walk (MF-0065)", () => {
  it("keeps the confident miss inside the WALK_SIZE cut, ahead of wilting skills", () => {
    // S1..S12: one correct answer 30 days ago → wilting Sprouts (12 water items > WALK_SIZE).
    const wilting = SKILLS.slice(0, 12).map((c) => at(c, 30, true));
    // S13: a Sapling (days 0, 2, 9 → 20, 18, 11 days ago) that lapsed two hours ago, tapped Sure.
    const miss = [
      at("S13", 20, true),
      at("S13", 18, true),
      at("S13", 11, true),
      at("S13", 2 / 24, false, "sure"),
    ];
    const plan = planWalk({
      pack,
      questions: SKILLS.map(q),
      attempts: [...wilting, ...miss],
      now: NOW,
    });
    expect(plan.needWaterCount).toBe(13);
    expect(plan.items).toHaveLength(WALK_SIZE);
    expect(plan.items[0]?.question.skillCode).toBe("S13");
    expect(plan.items[0]?.reason).toBe("water");
  });
});
