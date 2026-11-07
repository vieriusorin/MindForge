import type { TreeStage } from "@/engine/forest";
import type { LessonSkillOutcome } from "@/engine/lesson";
import { STAGE_LABEL } from "@/lib/forest-display";

const DAY = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
});

/** "a Seed", "an Ancient tree". */
function withArticle(stage: TreeStage): string {
  const label = STAGE_LABEL[stage];
  return /^[AEIOU]/.test(label) ? `an ${label}` : `a ${label}`;
}

/** D-L12: the tree's move in words, from the engine's change word. */
export function changeLine(
  skill: Pick<LessonSkillOutcome, "before" | "after" | "change">,
): string {
  const after = STAGE_LABEL[skill.after.stage];
  switch (skill.change) {
    case "grew":
      return `${STAGE_LABEL[skill.before.stage]} → ${after}`;
    case "watered":
      return `Watered: ${after}`;
    case "shrank":
      return `Back to ${after}`;
    case "same":
      return `Still ${withArticle(skill.after.stage)}`;
  }
}

/** "k of n correct", from the engine's counts. */
export function scoreLine(
  skill: Pick<LessonSkillOutcome, "answeredCount" | "correctCount">,
): string {
  return `${skill.correctCount} of ${skill.answeredCount} correct`;
}

/**
 * D-L11: the next review date as a UTC day (so server and client agree, labelled like the paths
 * screen), or why there is none. MF-0064 review: a fading tree says "Review now", never a past date.
 * `after.wilting` is exactly "the date is at or before now": `nextReviewAt` is the instant `treeStage`
 * turns wilting (SC-3), and `after` is replayed as of now.
 */
export function reviewLine(
  skill: Pick<LessonSkillOutcome, "after" | "nextReviewAt">,
): { text: string; zone: "UTC" | null } {
  if (skill.after.wilting) {
    return { text: "Review now: this tree is fading", zone: null };
  }
  return skill.nextReviewAt
    ? { text: `Next review: ${DAY.format(skill.nextReviewAt)}`, zone: "UTC" }
    : { text: "No review date: a seed does not fade", zone: null };
}

/** MF-0065 (DQ-12): how many times the mix-up was picked, in words. */
export function mixUpCountLine(count: number): string {
  return count === 1 ? "picked 1 time" : `picked ${count} times`;
}
