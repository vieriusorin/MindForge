import type { GroupHeatmap, HealthyBand, HeatmapStatus } from "@/engine/forest";

export interface GroupHeatmapProps {
  heatmap: GroupHeatmap;
}

export type BadgeVariant = "secondary" | "destructive" | "outline";

export interface StatusLook {
  label: string;
  badge: BadgeVariant;
}

export type StatusLooks = Record<HeatmapStatus, StatusLook>;

/** A healthy band's words and its swatch class on the chart ramp (ui-design §2). */
export interface BandLook {
  label: string;
  range: string;
  swatch: "bg-chart-1" | "bg-chart-3" | "bg-chart-5";
}

export type BandLooks = Record<HealthyBand, BandLook>;
