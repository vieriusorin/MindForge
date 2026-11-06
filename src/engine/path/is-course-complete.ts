import type { ForestView } from "../forest/build-forest";
import type { TreeStage } from "../forest/tree-stage";

/** MF-0058: the stages that count toward Course complete (Sapling or above). */
export const GROWN_STAGES = [
  "sapling",
  "tree",
  "ancient",
] as const satisfies readonly TreeStage[];

const GROWN: ReadonlySet<TreeStage> = new Set(GROWN_STAGES);

/**
 * MF-0058: Course complete = every skill of the pack at Sapling or above (wilting counts, C-1).
 * A forest with no trees is never complete.
 */
export function isCourseComplete(forest: ForestView): boolean {
  const trees = forest.regions.flatMap((region) => region.trees);
  return trees.length > 0 && trees.every((tree) => GROWN.has(tree.stage));
}
