import type { TreeStage } from "@/engine/forest";

export interface GrowthDonutProps {
  stageCounts: Record<TreeStage, number>;
  grownPercent: number;
  totalSkills: number;
}
