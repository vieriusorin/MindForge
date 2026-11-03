import { STAGE_ORDER, type TreeStage } from "@/engine/forest";
import { STAGE_LABEL } from "@/lib/forest-display";

export interface DonutDatum {
  stage: TreeStage;
  count: number;
  fill: string;
}

/** Stages in growth order, coloured light → dark (chart-1 … chart-5). Zero counts stay in the legend. */
export function donutData(counts: Record<TreeStage, number>): DonutDatum[] {
  return STAGE_ORDER.map((stage) => ({
    stage,
    count: counts[stage],
    fill: `var(--color-${stage})`,
  }));
}

/** shadcn ChartConfig: one entry per stage, label from the shared vocabulary. */
export const STAGE_CHART_CONFIG = Object.fromEntries(
  STAGE_ORDER.map((stage, i) => [
    stage,
    { label: STAGE_LABEL[stage], color: `var(--chart-${i + 1})` },
  ]),
) as Record<TreeStage, { label: string; color: string }>;
