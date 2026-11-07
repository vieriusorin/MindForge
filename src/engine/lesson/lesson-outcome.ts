import type { ReviewContext } from "../content/types";
import type { TreeStage, TreeState } from "../forest/tree-stage";
import { countableAttempts } from "../memory/countable";
import { nextReviewAt } from "../memory/next-review";
import type { Attempt } from "../memory/types";
import type { Pack } from "../pack/types";
import { courseForest } from "../path/course-forest";
import type { StormResult } from "../storm/types";
import type { LessonChange, LessonOutcome } from "./types";

export interface LessonOutcomeInput {
  pack: Pack;
  attempts: readonly Attempt[];
  review: ReviewContext;
  stormResults: readonly StormResult[];
  skillCode: string;
  /** When the lesson started (the player page's server time). */
  since: Date;
  now: Date;
}

const STAGE_RANK = {
  seed: 0,
  sprout: 1,
  sapling: 2,
  tree: 3,
  ancient: 4,
} as const satisfies Record<TreeStage, number>;

function changeOf(before: TreeState, after: TreeState): LessonChange {
  const delta = STAGE_RANK[after.stage] - STAGE_RANK[before.stage];
  if (delta > 0) return "grew";
  if (delta < 0) return "shrank";
  return before.wilting && !after.wilting ? "watered" : "same";
}

/**
 * MF-0064 SC-4 (D-L10..D-L12): the real tree changes of a lesson. Before = the forest replayed from
 * attempts answered before `since`, as of `since`; after = every attempt, as of `now`; both through
 * `courseForest`, the course map's recipe. The lesson's skill first, then every other skill answered
 * since `since`, in pack order.
 */
export function lessonOutcome(input: LessonOutcomeInput): LessonOutcome {
  const { pack, attempts, review, stormResults, skillCode, since, now } = input;
  const start = since.getTime();
  const during = attempts.filter((a) => a.answeredAt.getTime() >= start);
  const beforeForest = courseForest({
    pack,
    attempts: attempts.filter((a) => a.answeredAt.getTime() < start),
    review,
    stormResults,
    now: since,
  });
  const afterForest = courseForest({
    pack,
    attempts,
    review,
    stormResults,
    now,
  });
  const beforeTrees = new Map(
    beforeForest.regions.flatMap((r) => r.trees).map((t) => [t.skillCode, t]),
  );
  const answered = new Set(during.map((a) => a.skillCode));
  const countable = countableAttempts(attempts, review);

  const skills = afterForest.regions
    .flatMap((r) => r.trees)
    .filter((t) => t.skillCode === skillCode || answered.has(t.skillCode))
    .sort(
      (a, b) =>
        Number(b.skillCode === skillCode) - Number(a.skillCode === skillCode),
    )
    .map((tree) => {
      const old = beforeTrees.get(tree.skillCode);
      const before: TreeState = {
        stage: old?.stage ?? "seed",
        wilting: old?.wilting ?? false,
      };
      const after: TreeState = { stage: tree.stage, wilting: tree.wilting };
      const mine = during.filter((a) => a.skillCode === tree.skillCode);
      return {
        skillCode: tree.skillCode,
        name: tree.name,
        before,
        after,
        change: changeOf(before, after),
        answeredCount: mine.length,
        correctCount: mine.filter((a) => a.correct).length,
        nextReviewAt:
          after.stage === "seed"
            ? null
            : nextReviewAt(
                countable.filter((a) => a.skillCode === tree.skillCode),
              ),
      };
    });

  return { packSlug: pack.slug, skillCode, skills };
}
