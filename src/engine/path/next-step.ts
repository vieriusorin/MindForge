import type { ForestView } from "../forest/build-forest";
import { summarizeForest } from "../forest/summarize-forest";

/** MF-0062: the one obvious next step on a course map. */
export type NextStep =
  | { kind: "water"; skillCode: string }
  | { kind: "next"; skillCode: string }
  | { kind: "done" };

/**
 * MF-0062: Water first on the first wilting skill in `summarizeForest` focus order (Today's top
 * focus); else Next on the first Seed in map order; else the first Sprout; else done. Seeds come
 * before Sprouts because a Sprout grows only after a recall on a later day, so pointing back at a
 * just-planted Sprout would loop.
 */
export function nextStep(forest: ForestView): NextStep {
  const wilting = summarizeForest(forest, Number.POSITIVE_INFINITY).focus.find(
    (skill) => skill.wilting,
  );
  if (wilting) return { kind: "water", skillCode: wilting.skillCode };
  const trees = forest.regions.flatMap((region) => region.trees);
  const next =
    trees.find((tree) => tree.stage === "seed") ??
    trees.find((tree) => tree.stage === "sprout");
  return next ? { kind: "next", skillCode: next.skillCode } : { kind: "done" };
}
