import type { ReviewContext } from "../content/types";
import { buildForest, type ForestView } from "../forest/build-forest";
import { countableAttempts } from "../memory/countable";
import { memoryBySkill } from "../memory/memory-by-skill";
import type { Attempt } from "../memory/types";
import type { Pack } from "../pack/types";
import { stormProof } from "../storm/storm-proof";
import type { StormResult } from "../storm/types";

export interface CourseForestInput {
  pack: Pack;
  attempts: readonly Attempt[];
  review: ReviewContext;
  stormResults: readonly StormResult[];
  now: Date;
}

/**
 * MF-0058: a learner's forest for one pack, replayed from their graded attempts. The same recipe
 * Today runs inline: countable attempts only (MF-0007), storm proof (MF-0013), FSRS memory (MF-0003).
 */
export function courseForest(input: CourseForestInput): ForestView {
  const { pack, attempts, review, stormResults, now } = input;
  return buildForest(
    pack,
    memoryBySkill(
      countableAttempts(attempts, review),
      now,
      stormProof(stormResults, review.rejected),
    ),
  );
}
