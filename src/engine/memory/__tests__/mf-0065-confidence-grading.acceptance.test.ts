/**
 * MF-0065 acceptance (SC-4, SC-5, SC-7 engine part) — frozen. Expected values come from GOAL.md, never from
 * the code under test. ts-fsrs 5.4.2 probe (enable_fuzz false, GOAL F-2): a first answer gives stability
 * Again 0.2120, Hard 1.2931, Good 2.3065 days. A Sapling (Good on days 0, 2, 9: S 36.12) lapsing with Again
 * on day 20 gets S 2.3992 and R 1.0 for the first day (elapsed days are floored), so it is a non-wilting
 * Sprout: only the confident-miss rule (DQ-5) brings it back within 24 h.
 */
import { Rating } from "ts-fsrs";
import { describe, expect, it } from "vitest";
import { emptyReviewContext } from "../../content/review";
import { groupHeatmapFromAttempts } from "../../forest/group-heatmap";
import { treeStage } from "../../forest/tree-stage";
import { parsePack } from "../../pack/load-pack";
import type { Question } from "../../questions/types";
import { confidentMissAt } from "../confident-miss";
import { ratingFor } from "../grade";
import { nextReviewAt } from "../next-review";
import { planWalk } from "../plan-walk";
import { replayMemory } from "../replay";
import type { Attempt, Confidence } from "../types";

const DAY = 86_400_000;
const T0 = new Date("2026-11-01T09:00:00.000Z");
const day = (n: number): Date => new Date(T0.getTime() + n * DAY);

function attempt(
  correct: boolean,
  at: Date,
  confidence?: Confidence | null,
  skillCode = "S1",
  questionId = `p.${skillCode}.q1`,
): Attempt {
  return {
    questionId,
    skillCode,
    correct,
    answeredAt: at,
    ...(confidence === undefined ? {} : { confidence }),
  };
}

/** Good on days 0, 2 and 9 (no tap): a Sapling of S ≈ 36 d. */
const sapling = (skillCode = "S1"): Attempt[] =>
  [0, 2, 9].map((d) => attempt(true, day(d), null, skillCode));

describe("MF-0065 SC-4: confidence grades the FSRS rating", () => {
  it("SC-4: ratingFor maps (correct, confidence) per DQ-4", () => {
    expect(ratingFor({ correct: true, confidence: "sure" })).toBe(Rating.Good);
    expect(ratingFor({ correct: true, confidence: "unsure" })).toBe(
      Rating.Hard,
    );
    expect(ratingFor({ correct: false, confidence: "sure" })).toBe(
      Rating.Again,
    );
    expect(ratingFor({ correct: false, confidence: "unsure" })).toBe(
      Rating.Again,
    );
    expect(ratingFor({ correct: true })).toBe(Rating.Good);
    expect(ratingFor({ correct: true, confidence: null })).toBe(Rating.Good);
    expect(ratingFor({ correct: false })).toBe(Rating.Again);
  });

  it("SC-4: one first answer replays to the probed stabilities", () => {
    const stability = (a: Attempt): number | undefined =>
      replayMemory([a], day(1))?.stabilityDays;
    expect(stability(attempt(true, T0, "sure"))).toBeCloseTo(2.3065, 4);
    expect(stability(attempt(true, T0, "unsure"))).toBeCloseTo(1.2931, 4);
    expect(stability(attempt(false, T0, "sure"))).toBeCloseTo(0.212, 4);
    expect(stability(attempt(true, T0))).toBeCloseTo(2.3065, 4);
  });

  it("SC-4: a correct but unsure answer is still a successful recall", () => {
    expect(
      replayMemory([attempt(true, T0, "unsure")], day(1))?.successfulRecalls,
    ).toBe(1);
  });
});

describe("MF-0065 SC-5: a confident miss asks for a review within 24 h", () => {
  const missAt = day(20);

  it("SC-5 CM1–CM6: confidentMissAt", () => {
    expect(confidentMissAt([])).toBeNull(); // CM1
    expect(confidentMissAt([attempt(true, T0, "sure")])).toBeNull(); // CM2
    expect(
      confidentMissAt([...sapling(), attempt(false, missAt, "sure")]),
    ).toEqual(missAt); // CM3
    expect(
      confidentMissAt([...sapling(), attempt(false, missAt, "unsure")]),
    ).toBeNull(); // CM4
    expect(
      confidentMissAt([
        attempt(false, missAt, "sure"),
        attempt(true, day(21), "unsure"),
      ]),
    ).toBeNull(); // CM5
    expect(confidentMissAt([attempt(false, missAt)])).toBeNull(); // CM6
  });

  it("SC-5: the latest attempt decides, whatever the input order", () => {
    expect(
      confidentMissAt([attempt(false, missAt, "sure"), ...sapling()]),
    ).toEqual(missAt);
  });

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
      - { code: S1, name: S1, weight: 50 }
      - { code: S2, name: S2, weight: 50 }
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
  const questions = [q("p.S1.q1", "S1"), q("p.S2.q1", "S2")];
  const now = new Date(missAt.getTime() + 2 * 3_600_000);
  const reasonOf = (attempts: Attempt[], skill: string) =>
    planWalk({ pack, questions, attempts, now }).items.find(
      (i) => i.question.skillCode === skill,
    )?.reason;

  it("SC-5 CM3: the lapsed Sapling is a non-wilting Sprout, yet the walk waters it", () => {
    const attempts = [...sapling(), attempt(false, missAt, "sure")];
    const memory = replayMemory(attempts, now);
    expect(memory?.stabilityDays).toBeCloseTo(2.3992, 3);
    expect(memory ? treeStage(memory) : null).toMatchObject({
      stage: "sprout",
      wilting: false,
    });
    // S2 is unseen, so the walk has a head and padding is allowed either way.
    expect(reasonOf(attempts, "S1")).toBe("water");
  });

  it("SC-5 CM4 / CM5: wrong + unsure, or a later answer, leaves FSRS in charge", () => {
    expect(
      reasonOf([...sapling(), attempt(false, missAt, "unsure")], "S1"),
    ).toBe("strengthen");
    const later = new Date(missAt.getTime() + 3_600_000);
    expect(
      reasonOf(
        [
          ...sapling(),
          attempt(false, missAt, "sure"),
          attempt(true, later, "sure"),
        ],
        "S1",
      ),
    ).toBe("strengthen");
  });

  it("SC-5 CM7: the next review is the miss + 24 h when that comes before the fade", () => {
    expect(
      nextReviewAt([
        ...sapling(),
        attempt(false, missAt, "sure"),
      ])?.toISOString(),
    ).toBe("2026-11-22T09:00:00.000Z");
  });

  it("SC-5 CM7: without the tap the next review stays the fade date (days later)", () => {
    const fade = nextReviewAt([...sapling(), attempt(false, missAt)]);
    expect(fade).not.toBeNull();
    expect((fade?.getTime() ?? 0) - missAt.getTime()).toBeGreaterThan(DAY);
  });

  it("SC-5 CM8: a confident miss on a Seed gives no review date (a Seed never fades)", () => {
    expect(nextReviewAt([attempt(false, missAt, "sure")])).toBeNull();
  });
});

describe("MF-0065 SC-7: no group figure from confidence", () => {
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
  // One correct answer each, four days before now: Good keeps R ≈ 0.858 (healthy), Hard would not.
  const now = day(4);
  const member = (confidence?: Confidence) => ({
    attempts: [attempt(true, T0, confidence)],
    review: emptyReviewContext(),
  });
  const heatmap = (confidence?: Confidence) =>
    groupHeatmapFromAttempts({
      pack,
      now,
      viewer: member(confidence),
      others: [member(confidence), member(confidence), member(confidence)],
    });

  it("SC-7: the heatmap is identical with sure, unsure or no taps", () => {
    const plain = heatmap();
    expect(plain.status).toBe("ready");
    expect(heatmap("unsure")).toEqual(plain);
    expect(heatmap("sure")).toEqual(plain);
  });
});
