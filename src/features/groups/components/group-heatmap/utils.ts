import type { HeatmapRegion, HeatmapStatus } from "@/engine/forest";
import type { HeatBucket, StatusLook, StatusLooks } from "./types";

/** Lower bound (healthy %) of each swatch bucket. The legend reads these, so they can't drift. */
export const HEAT_BUCKETS = [
  { bucket: 1, from: 0, to: 19 },
  { bucket: 2, from: 20, to: 39 },
  { bucket: 3, from: 40, to: 59 },
  { bucket: 4, from: 60, to: 79 },
  { bucket: 5, from: 80, to: 100 },
] as const satisfies readonly {
  bucket: HeatBucket;
  from: number;
  to: number;
}[];

/** Full class names so Tailwind keeps them (no string building). */
export const SWATCH_CLASS = {
  1: "bg-chart-1",
  2: "bg-chart-2",
  3: "bg-chart-3",
  4: "bg-chart-4",
  5: "bg-chart-5",
} as const satisfies Record<HeatBucket, string>;

const STATUS_LOOK = {
  holding: { label: "Holding", badge: "secondary" },
  fading: { label: "Fading", badge: "destructive" },
  "no-data": { label: "No data yet", badge: "outline" },
} as const satisfies StatusLooks;

/** The swatch bucket for a region's healthy share. */
export function heatBucket(healthyPercent: number): HeatBucket {
  const match = HEAT_BUCKETS.findLast((b) => healthyPercent >= b.from);
  return match?.bucket ?? 1;
}

/** The word and badge for a region's status: colour is never the only signal (ui-design §5). */
export function statusLook(status: HeatmapStatus): StatusLook {
  return STATUS_LOOK[status];
}

/** The figures line under a region's name. */
export function regionFigures(region: HeatmapRegion): string {
  const recall =
    region.retrievabilityPercent === null
      ? "no recall measured yet"
      : `${region.retrievabilityPercent}% average recall`;
  return `${region.healthyPercent}% healthy trees · ${recall}`;
}

/** Why the heatmap is hidden. No count: in a small group it tells who has played (MF-0011 C-3). */
export function notEnoughDataLine(requiredOthers: number): string {
  return `Not enough data yet. The heatmap appears once at least ${requiredOthers} other members have answered questions.`;
}
