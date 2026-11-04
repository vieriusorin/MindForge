import type { GroupHeatmap, HeatmapStatus } from "@/engine/forest";

export interface GroupHeatmapProps {
  heatmap: GroupHeatmap;
}

/** The swatch ramp: chart-1 (lightest) … chart-5 (darkest), ui-design §2. */
export type HeatBucket = 1 | 2 | 3 | 4 | 5;

export type BadgeVariant = "secondary" | "destructive" | "outline";

export interface StatusLook {
  label: string;
  badge: BadgeVariant;
}

export type StatusLooks = Record<HeatmapStatus, StatusLook>;
