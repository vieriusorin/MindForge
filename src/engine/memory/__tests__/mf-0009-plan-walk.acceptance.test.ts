import { describe, expect, it } from "vitest";
import { parsePack } from "../../pack/load-pack";
import type { Question } from "../../questions/types";
import { planWalk } from "../plan-walk";
import type { Attempt } from "../types";

// MF-0009 SC-1 — frozen. Expected values come from GOAL.md, never from planWalk's output.

const now = new Date(Date.UTC(2026, 10, 1, 12));
const ago = (days: number): Date => new Date(now.getTime() - days * 86_400_000);
const HOUR = 1 / 24;

const packOf = (skills: [code: string, weight: number][]) =>
  parsePack(`
slug: p
name: P
kind: course
version: 1
domains:
  - code: D
    name: D
    weight: 100
    skills:
${skills.map(([c, w]) => `      - { code: ${c}, name: ${c}, weight: ${w} }`).join("\n")}
`);

const q = (id: string, skillCode: string): Question => ({
  id,
  skillCode,
  origin: "ai",
  author: "author@example.com",
  stem: id,
  select: 1,
  options: [
    { id: "A", text: "a", correct: true, rationale: "r" },
    { id: "B", text: "b", correct: false, rationale: "r" },
  ],
  source: { title: "t", url: "https://example.com" },
});
const oneEach = (codes: string[]): Question[] =>
  codes.map((c) => q(`p.${c}.1`, c));

const attempt = (
  skillCode: string,
  daysAgo: number,
  correct: boolean,
  questionId = `p.${skillCode}.1`,
): Attempt => ({ questionId, skillCode, correct, answeredAt: ago(daysAgo) });
/** Recalled an hour ago: retrievability ≈ 1, not due. */
const healthy = (c: string): Attempt => attempt(c, HOUR, true);
/** Recalled once, 30 days ago: a wilting sprout. */
const wilting = (c: string, daysAgo = 30): Attempt => attempt(c, daysAgo, true);

const skillsOf = (plan: ReturnType<typeof planWalk>): string[] =>
  plan.items.map((i) => i.question.skillCode);
const reasonsOf = (plan: ReturnType<typeof planWalk>): string[] =>
  plan.items.map((i) => i.reason);

describe("MF-0009 planWalk", () => {
  it("SC-1: skills that need water come first, heavier first at equal memory", () => {
    const pack = packOf([
      ["A", 30],
      ["B", 20],
      ["C", 25],
      ["E", 25],
    ]);
    const plan = planWalk({
      pack,
      questions: oneEach(["A", "B", "C", "E"]),
      attempts: [healthy("A"), wilting("B"), wilting("C"), healthy("E")],
      now,
    });
    expect(skillsOf(plan).slice(0, 2)).toEqual(["C", "B"]);
    expect(reasonsOf(plan).slice(0, 2)).toEqual(["water", "water"]);
    expect(plan.needWaterCount).toBe(2);
  });

  it("SC-1: at equal weight, the weaker memory (lower R) comes first, regardless of pack order", () => {
    const pack = packOf([
      ["Y", 50],
      ["X", 50],
    ]);
    const plan = planWalk({
      pack,
      questions: oneEach(["Y", "X"]),
      attempts: [wilting("Y", 10), wilting("X", 60)],
      now,
    });
    expect(skillsOf(plan)).toEqual(["X", "Y"]);
    expect(reasonsOf(plan)).toEqual(["water", "water"]);
  });

  it("SC-1: a skill attempted but never recalled needs water", () => {
    const pack = packOf([
      ["A", 90],
      ["F", 10],
    ]);
    const plan = planWalk({
      pack,
      questions: oneEach(["A", "F"]),
      attempts: [healthy("A"), attempt("F", HOUR, false)],
      now,
    });
    expect(plan.needWaterCount).toBe(1);
    expect(plan.items[0]?.question.skillCode).toBe("F");
    expect(plan.items[0]?.reason).toBe("water");
  });

  it("SC-1: at most one unseen skill (the heaviest) follows the watering, then not-due skills pad the walk", () => {
    const pack = packOf([
      ["H", 40],
      ["N1", 10],
      ["N2", 20],
      ["W", 30],
    ]);
    const plan = planWalk({
      pack,
      questions: oneEach(["H", "N1", "N2", "W"]),
      attempts: [healthy("H"), wilting("W")],
      now,
    });
    expect(skillsOf(plan)).toEqual(["W", "N2", "H"]);
    expect(reasonsOf(plan)).toEqual(["water", "new", "strengthen"]);
    expect(plan.needWaterCount).toBe(1);
  });

  it("SC-1: a walk with only a new seed to plant is not empty", () => {
    const pack = packOf([
      ["H", 90],
      ["N", 10],
    ]);
    const plan = planWalk({
      pack,
      questions: oneEach(["H", "N"]),
      attempts: [healthy("H")],
      now,
    });
    expect(skillsOf(plan)).toEqual(["N", "H"]);
    expect(reasonsOf(plan)).toEqual(["new", "strengthen"]);
    expect(plan.needWaterCount).toBe(0);
  });

  it("SC-1: at most 10 items, one per skill; a full watering list leaves no room for a new seed", () => {
    const codes = Array.from({ length: 12 }, (_, i) => `S${i + 1}`);
    const pack = packOf([
      ...codes.map((c): [string, number] => [c, 8]),
      ["NEW", 4],
    ]);
    const questions = [
      ...codes.flatMap((c) => [q(`p.${c}.1`, c), q(`p.${c}.2`, c)]),
      q("p.NEW.1", "NEW"),
    ];
    const plan = planWalk({
      pack,
      questions,
      attempts: codes.map((c) => wilting(c)),
      now,
    });
    expect(plan.items).toHaveLength(10);
    expect(new Set(skillsOf(plan)).size).toBe(10);
    expect(reasonsOf(plan)).toEqual(Array(10).fill("water"));
    expect(plan.needWaterCount).toBe(12);
  });

  it("SC-1: within a skill, serves the least recently seen question, never-seen first", () => {
    const pack = packOf([["W", 100]]);
    const plan = planWalk({
      pack,
      questions: [q("p.W.1", "W"), q("p.W.2", "W"), q("p.W.3", "W")],
      attempts: [
        attempt("W", 30, true, "p.W.1"),
        attempt("W", 31, true, "p.W.3"),
      ],
      now,
    });
    expect(plan.items.map((i) => i.question.id)).toEqual(["p.W.2"]);
  });

  it("SC-1: skills without a playable question are skipped and not counted", () => {
    const pack = packOf([
      ["A", 50],
      ["Q", 50],
    ]);
    const plan = planWalk({
      pack,
      questions: oneEach(["A"]),
      attempts: [wilting("A"), wilting("Q")],
      now,
    });
    expect(skillsOf(plan)).toEqual(["A"]);
    expect(plan.needWaterCount).toBe(1);
  });

  it("SC-1: empty plan when nothing needs water and every skill with a question is seen", () => {
    const pack = packOf([
      ["A", 50],
      ["B", 30],
      ["Z", 20],
    ]);
    const plan = planWalk({
      pack,
      questions: oneEach(["A", "B"]),
      attempts: [healthy("A"), healthy("B")],
      now,
    });
    expect(plan.items).toEqual([]);
    expect(plan.needWaterCount).toBe(0);
  });
});
