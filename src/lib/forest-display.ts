import {
  Bean,
  Leaf,
  type LucideIcon,
  Sprout,
  TreeDeciduous,
  TreePine,
} from "lucide-react";
import { FOREST_THRESHOLDS, type TreeStage } from "@/engine/forest";

/** lucide-react icon per stage (the project's only icon set). */
export const STAGE_ICON = {
  seed: Bean,
  sprout: Sprout,
  sapling: Leaf,
  tree: TreeDeciduous,
  ancient: TreePine,
} as const satisfies Record<TreeStage, LucideIcon>;

export const STAGE_LABEL = {
  seed: "Seed",
  sprout: "Sprout",
  sapling: "Sapling",
  tree: "Tree",
  ancient: "Ancient tree",
} as const satisfies Record<TreeStage, string>;

const T = FOREST_THRESHOLDS;

/** What each stage means, in the learner's words. Built from the engine thresholds so they can't drift. */
export const STAGE_HINT = {
  seed: "Not recalled correctly yet",
  sprout: "Recalled correctly at least once",
  sapling: `Remembered for ${T.saplingStabilityDays}+ days`,
  tree: `Remembered ${T.treeStabilityDays}+ days and explained it back`,
  ancient: `Remembered ${T.ancientStabilityDays}+ days and survived a storm`,
} as const satisfies Record<TreeStage, string>;

/** Blueprint weights are one-decimal percentages: 33.1 → "33.1%", 11 → "11.0%". */
export function formatWeight(weight: number): string {
  return `${weight.toFixed(1)}%`;
}
