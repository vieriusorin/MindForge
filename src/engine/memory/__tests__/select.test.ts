import { describe, expect, it } from "vitest";
import { parsePack } from "../../pack/load-pack";
import type { Question } from "../../questions/types";
import { pickSessionQuestions } from "../select";

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
      - { code: A, name: A, weight: 50 }
      - { code: B, name: B, weight: 30 }
      - { code: C, name: C, weight: 20 }
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
const now = new Date(Date.UTC(2026, 10, 1));

describe("pickSessionQuestions", () => {
  it("skips skills without questions and returns fewer than size when needed", () => {
    const picked = pickSessionQuestions({
      pack,
      questions: [q("p.A.1", "A"), q("p.C.1", "C")],
      attempts: [],
      now,
    });
    expect(picked.map((x) => x.id)).toEqual(["p.A.1", "p.C.1"]);
  });

  it("within a skill picks the least recently seen question, never-seen first", () => {
    const questions = [q("p.A.1", "A"), q("p.A.2", "A"), q("p.A.3", "A")];
    const attempts = [
      {
        questionId: "p.A.1",
        skillCode: "A",
        correct: false,
        answeredAt: new Date(now.getTime() - 1000),
      },
      {
        questionId: "p.A.2",
        skillCode: "A",
        correct: false,
        answeredAt: new Date(now.getTime() - 5000),
      },
    ];
    expect(
      pickSessionQuestions({ pack, questions, attempts, now, size: 1 })[0]?.id,
    ).toBe("p.A.3");
    const allSeen = [
      ...attempts,
      { questionId: "p.A.3", skillCode: "A", correct: false, answeredAt: now },
    ];
    expect(
      pickSessionQuestions({
        pack,
        questions,
        attempts: allSeen,
        now,
        size: 1,
      })[0]?.id,
    ).toBe("p.A.2");
  });
});
