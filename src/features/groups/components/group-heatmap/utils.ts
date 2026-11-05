import {
  HEALTHY_BANDS,
  type HealthyBand,
  type HeatmapStatus,
} from "@/engine/forest";
import type { BandLook, BandLooks, StatusLook, StatusLooks } from "./types";

/**
 * MF-0021: each band in words, with a swatch on the one-hue ramp (ui-design §2). Full class names
 * so Tailwind keeps them. The legend reads this table, so it can't drift.
 */
const BAND_LOOK = {
  few: {
    label: "Few healthy trees",
    range: "under a third",
    swatch: "bg-chart-1",
  },
  some: {
    label: "Some healthy trees",
    range: "a third to two thirds",
    swatch: "bg-chart-3",
  },
  most: {
    label: "Most healthy trees",
    range: "two thirds or more",
    swatch: "bg-chart-5",
  },
} as const satisfies BandLooks;

const STATUS_LOOK = {
  holding: { label: "Holding", badge: "secondary" },
  fading: { label: "Fading", badge: "destructive" },
  "no-data": { label: "No data yet", badge: "outline" },
} as const satisfies StatusLooks;

/** The words and swatch for a region's healthy band: no percent, so no count (MF-0021). */
export function bandLook(band: HealthyBand): BandLook {
  return BAND_LOOK[band];
}

/** The legend rows, lightest to darkest, in the engine's band order. */
export const BAND_LEGEND: readonly BandLook[] = HEALTHY_BANDS.map(bandLook);

/** The word and badge for a region's status: colour is never the only signal (ui-design §5). */
export function statusLook(status: HeatmapStatus): StatusLook {
  return STATUS_LOOK[status];
}

/** Why the heatmap is hidden. No count: in a small group it tells who has played (MF-0011 C-3). */
export function notEnoughDataLine(requiredOthers: number): string {
  return `Not enough data yet. The heatmap appears once at least ${requiredOthers} other members have answered questions.`;
}
