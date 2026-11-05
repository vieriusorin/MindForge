import type { StormResultQuestion } from "./types";

export interface SkillTally {
  readonly scored: number;
  readonly correct: number;
}

/**
 * Per-skill tally of a storm's scored questions: voided ones are left out, an unanswered one is
 * scored and wrong (GOAL.md, decided 2026-11-04). Internal to the storm module.
 */
export function tallyBySkill(
  questions: readonly Pick<
    StormResultQuestion,
    "skillCode" | "correct" | "voided"
  >[],
): Map<string, SkillTally> {
  const out = new Map<string, SkillTally>();
  for (const q of questions) {
    if (q.voided) continue;
    const prev = out.get(q.skillCode) ?? { scored: 0, correct: 0 };
    out.set(q.skillCode, {
      scored: prev.scored + 1,
      correct: prev.correct + (q.correct === true ? 1 : 0),
    });
  }
  return out;
}

/** CONTEXT.md "Storm-proven skill": every scored question right, and at least two of them. */
export function isProven(tally: SkillTally): boolean {
  return tally.scored >= 2 && tally.correct === tally.scored;
}
