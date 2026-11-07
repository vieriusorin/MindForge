/**
 * MF-0064 acceptance (SC-4): the close screen's figures, replayed from graded attempts (D-L10..D-L12).
 * Rows O1–O6 from .planning/tasks/MF-0064/GOAL.md. ts-fsrs probes (5.4.2, no fuzz) behind the
 * fixtures: two Goods one day apart → S 7.315 d (Sapling), R at +20 d 0.818 (fading); an Again two days
 * later → S 1.120 d (Sprout again); a Good after the fade → S 54.6 d, still a Sapling (Tree needs a
 * storm proof). One Good fades 5 whole days later (SC-3).
 */
import { describe, expect, it } from "vitest";
import { emptyReviewContext } from "@/engine/content";
import { type LessonOutcome, lessonOutcome } from "@/engine/lesson";
import type { Attempt } from "@/engine/memory";
import type { Pack } from "@/engine/pack";
import { courseForest } from "@/engine/path";

const PACK: Pack = {
  slug: "demo",
  name: "Demo",
  kind: "course",
  version: 1,
  domains: [
    {
      code: "A",
      name: "Domain A",
      weight: 60,
      skills: [
        { code: "A1", name: "First skill", weight: 30 },
        { code: "A2", name: "Second skill", weight: 30 },
      ],
    },
    {
      code: "B",
      name: "Domain B",
      weight: 40,
      skills: [{ code: "B1", name: "Third skill", weight: 40 }],
    },
  ],
};

const MIN = 60_000;
const DAY = 86_400_000;
const SINCE = new Date("2026-11-01T10:00:00.000Z");
const NOW = new Date(SINCE.getTime() + 30 * MIN);

function at(offsetMs: number): Date {
  return new Date(SINCE.getTime() + offsetMs);
}

function attempt(
  skillCode: string,
  correct: boolean,
  answeredAt: Date,
  n = 1,
): Attempt {
  return { questionId: `${skillCode}.q${n}`, skillCode, correct, answeredAt };
}

function outcome(attempts: Attempt[], skillCode = "A2"): LessonOutcome {
  return lessonOutcome({
    pack: PACK,
    attempts,
    review: emptyReviewContext(),
    stormResults: [],
    skillCode,
    since: SINCE,
    now: NOW,
  });
}

describe("MF-0064 SC-4: lessonOutcome (O1–O6)", () => {
  it("SC-4 O1: a Seed answered correctly grows to a Sprout, with a next review date", () => {
    const o = outcome([attempt("A2", true, at(MIN))]);
    expect(o.packSlug).toBe("demo");
    expect(o.skillCode).toBe("A2");
    expect(o.skills).toHaveLength(1);
    expect(o.skills[0]).toMatchObject({
      skillCode: "A2",
      name: "Second skill",
      before: { stage: "seed", wilting: false },
      after: { stage: "sprout", wilting: false },
      change: "grew",
      answeredCount: 1,
      correctCount: 1,
    });
    expect(o.skills[0]?.nextReviewAt?.toISOString()).toBe(
      "2026-11-06T10:01:00.000Z",
    );
  });

  it("SC-4 O2: a Seed answered wrong stays a Seed, with no review date", () => {
    const o = outcome([
      attempt("A2", false, at(MIN)),
      attempt("A2", false, at(2 * MIN), 2),
    ]);
    expect(o.skills[0]).toMatchObject({
      before: { stage: "seed", wilting: false },
      after: { stage: "seed", wilting: false },
      change: "same",
      answeredCount: 2,
      correctCount: 0,
      nextReviewAt: null,
    });
  });

  it("SC-4 O3: a fading Sapling answered correctly is watered", () => {
    const o = outcome([
      attempt("A2", true, at(-21 * DAY)),
      attempt("A2", true, at(-20 * DAY), 2),
      attempt("A2", true, at(MIN), 3),
    ]);
    expect(o.skills[0]).toMatchObject({
      before: { stage: "sapling", wilting: true },
      after: { stage: "sapling", wilting: false },
      change: "watered",
      answeredCount: 1,
      correctCount: 1,
    });
  });

  it("SC-4 O4: a Sapling answered wrong drops back to a Sprout", () => {
    const o = outcome([
      attempt("A2", true, at(-3 * DAY)),
      attempt("A2", true, at(-2 * DAY), 2),
      attempt("A2", false, at(MIN), 3),
    ]);
    expect(o.skills[0]).toMatchObject({
      before: { stage: "sapling", wilting: false },
      after: { stage: "sprout" },
      change: "shrank",
      answeredCount: 1,
      correctCount: 0,
    });
  });

  it("SC-4 O5: no answer since the start: only the lesson's skill, unchanged", () => {
    const o = outcome([attempt("A1", true, at(-DAY))]);
    expect(o.skills.map((s) => s.skillCode)).toEqual(["A2"]);
    expect(o.skills[0]).toMatchObject({
      change: "same",
      answeredCount: 0,
      correctCount: 0,
    });
  });

  it("SC-4 O6: the lesson's skill first, then other skills answered since, in pack order", () => {
    const o = outcome(
      [
        attempt("B1", true, at(MIN)),
        attempt("A1", true, at(2 * MIN)),
        attempt("A2", true, at(3 * MIN)),
        attempt("A1", false, at(-DAY), 2),
      ],
      "A2",
    );
    expect(o.skills.map((s) => s.skillCode)).toEqual(["A2", "A1", "B1"]);
    expect(o.skills[1]).toMatchObject({ answeredCount: 1, correctCount: 1 });
  });

  it("SC-4: after equals the forest the course map shows (courseForest on every attempt)", () => {
    const attempts = [
      attempt("A1", true, at(-3 * DAY)),
      attempt("A1", true, at(-2 * DAY), 2),
      attempt("A1", false, at(MIN), 3),
      attempt("A2", true, at(2 * MIN)),
      attempt("B1", false, at(3 * MIN)),
    ];
    const o = outcome(attempts);
    const forest = courseForest({
      pack: PACK,
      attempts,
      review: emptyReviewContext(),
      stormResults: [],
      now: NOW,
    });
    const trees = new Map(
      forest.regions.flatMap((r) => r.trees).map((t) => [t.skillCode, t]),
    );
    expect(o.skills).toHaveLength(3);
    for (const s of o.skills) {
      const tree = trees.get(s.skillCode);
      expect(s.after).toEqual({ stage: tree?.stage, wilting: tree?.wilting });
    }
  });
});
