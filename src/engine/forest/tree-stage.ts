export type TreeStage = "seed" | "sprout" | "sapling" | "tree" | "ancient";

/** Measured memory signals for one skill. Nothing here measures time-in-app or activity. */
export interface MemorySnapshot {
  successfulRecalls: number;
  stabilityDays: number;
  retrievability: number;
  feynmanPassed: boolean;
  /** Proven in any storm (CONTEXT.md "Storm-proven skill"): with stability ≥ 14 d, a Tree. */
  stormProven: boolean;
  /** Proven in a Full Storm: with stability ≥ 45 d, an Ancient tree. */
  fullStormProven: boolean;
}

export interface TreeState {
  stage: TreeStage;
  wilting: boolean;
}

/** Spec docs/MINDFORGE.md §2.2. Changing a value here changes what "growing" means for every learner. */
export const FOREST_THRESHOLDS = {
  saplingStabilityDays: 3,
  treeStabilityDays: 14,
  ancientStabilityDays: 45,
  wiltBelowRetrievability: 0.85,
} as const;

function stageOf(memory: MemorySnapshot): TreeStage {
  const t = FOREST_THRESHOLDS;
  if (memory.successfulRecalls < 1) return "seed";
  // MF-0013 (CONTEXT.md): Feynman cut, so a storm proof is the other road to Tree; only a Full Storm reaches Ancient.
  if (
    memory.stabilityDays >= t.ancientStabilityDays &&
    memory.fullStormProven
  ) {
    return "ancient";
  }
  if (
    memory.stabilityDays >= t.treeStabilityDays &&
    (memory.feynmanPassed || memory.stormProven)
  ) {
    return "tree";
  }
  if (memory.stabilityDays >= t.saplingStabilityDays) return "sapling";
  return "sprout";
}

/** Map measured memory to a tree. A tree never dies: the lowest state is a seed, and only living trees wilt. */
export function treeStage(memory: MemorySnapshot | null): TreeState {
  if (memory === null) return { stage: "seed", wilting: false };
  const stage = stageOf(memory);
  const wilting =
    stage !== "seed" &&
    memory.retrievability < FOREST_THRESHOLDS.wiltBelowRetrievability;
  return { stage, wilting };
}
