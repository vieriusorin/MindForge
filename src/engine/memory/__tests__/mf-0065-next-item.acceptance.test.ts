/**
 * MF-0065 acceptance (SC-6) — frozen. The next item in a skill: last answered wrong (least recently wrong
 * first), then never answered (file order), then least recently answered (GOAL DQ-11, rows NI1–NI5). The
 * Daily Walk serves the first item of that order. Expected values come from GOAL.md.
 */
import { describe, expect, it } from "vitest";
import { parsePack } from "../../pack/load-pack";
import type { Question } from "../../questions/types";
import { orderSkillItems } from "../order-skill-items";
import { planWalk } from "../plan-walk";
import type { Attempt } from "../types";

const T = (h: number): Date => new Date(Date.UTC(2026, 9, 1, h));
const items = (...ids: string[]) => ids.map((id) => ({ id }));
const answer = (questionId: string, h: number, correct: boolean): Attempt => ({
  questionId,
  skillCode: "S1",
  correct,
  answeredAt: T(h),
});
const ids = (list: { id: string }[]): string[] => list.map((i) => i.id);

describe("MF-0065 SC-6: orderSkillItems", () => {
  it("SC-6 NI1: nothing answered keeps file order", () => {
    expect(ids(orderSkillItems(items("q1", "q2"), []))).toEqual(["q1", "q2"]);
  });

  it("SC-6 NI2: never answered comes before answered right", () => {
    expect(
      ids(orderSkillItems(items("q1", "q2"), [answer("q1", 1, true)])),
    ).toEqual(["q2", "q1"]);
  });

  it("SC-6 NI3: last answered wrong comes before never answered", () => {
    expect(
      ids(orderSkillItems(items("q1", "q2"), [answer("q2", 1, false)])),
    ).toEqual(["q2", "q1"]);
  });

  it("SC-6 NI4: two wrong items, the least recently wrong first", () => {
    expect(
      ids(
        orderSkillItems(items("q1", "q2"), [
          answer("q1", 2, false),
          answer("q2", 1, false),
        ]),
      ),
    ).toEqual(["q2", "q1"]);
  });

  it("SC-6 NI5: only the last answer counts; answered right, least recent first", () => {
    expect(
      ids(
        orderSkillItems(items("q1", "q2", "q3"), [
          answer("q3", 0, false),
          answer("q1", 1, true),
          answer("q2", 2, true),
          answer("q3", 3, true),
        ]),
      ),
    ).toEqual(["q1", "q2", "q3"]);
  });

  it("SC-6: the input arrays are not mutated", () => {
    const list = items("q1", "q2");
    orderSkillItems(list, [answer("q2", 1, false)]);
    expect(ids(list)).toEqual(["q1", "q2"]);
  });
});

describe("MF-0065 SC-6: the Daily Walk re-asks the item last answered wrong", () => {
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
      - { code: S1, name: S1, weight: 100 }
`);
  const q = (id: string): Question => ({
    id,
    skillCode: "S1",
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

  it("SC-6: a skill whose second item was just missed serves that item, not the unseen third", () => {
    const now = new Date(Date.UTC(2026, 9, 20));
    const attempts: Attempt[] = [
      answer("p.S1.q1", 0, true),
      answer("p.S1.q2", 1, false),
    ];
    const plan = planWalk({
      pack,
      questions: [q("p.S1.q1"), q("p.S1.q2"), q("p.S1.q3")],
      attempts,
      now,
    });
    expect(plan.items.map((i) => i.question.id)).toEqual(["p.S1.q2"]);
  });
});
