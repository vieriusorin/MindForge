import type { TreeStage } from "../forest/tree-stage";

/** MF-0062: the existing modes a course-map node opens. A skill-scoped lesson arrives with MF-0064. */
export const NODE_MODES = ["plant", "walk", "duel"] as const;
export type NodeMode = (typeof NODE_MODES)[number];

export interface NodeModeInput {
  stage: TreeStage;
  wilting: boolean;
  /** The skill has a playable card, diagram or check (`plantableSkills`, MF-0010). */
  isPlantable: boolean;
}

/** MF-0062: which existing mode a node opens (GOAL edge table M1–M7). */
export function nodeMode({
  stage,
  wilting,
  isPlantable,
}: NodeModeInput): NodeMode {
  // The Daily Walk waters every wilting skill first (MF-0009), whatever its stage.
  if (wilting) return "walk";
  if (stage === "seed" || stage === "sprout") {
    // No skill-scoped Walk exists yet (MF-0064): Seed Planting is the one mode scoped to this skill.
    return isPlantable ? "plant" : "walk";
  }
  return "duel";
}
