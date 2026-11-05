import type { ReviewContext } from "../content/types";
import { countableAttempts } from "../memory/countable";
import { memoryBySkill } from "../memory/memory-by-skill";
import type { Attempt } from "../memory/types";
import type { Pack } from "../pack/types";
import {
  FOREST_THRESHOLDS,
  type MemorySnapshot,
  treeStage,
} from "./tree-stage";

/**
 * D-4 + MF-0011 C-3 (user, 2026-11-04): the heatmap appears only when at least this many members
 * OTHER than the viewer have played, so the viewer's own trees never make up a third of a figure.
 */
export const MIN_OTHER_CONTRIBUTORS = 3;

export type HeatmapStatus = "holding" | "fading" | "no-data";

/**
 * MF-0021 (user, 2026-11-05): the healthy share as a third, never a percent. Each band is at least ⅓
 * wide, so every band is reachable for every pair count ≥ 3 and no figure pins how many have played.
 */
export const HEALTHY_BANDS = ["few", "some", "most"] as const;
export type HealthyBand = (typeof HEALTHY_BANDS)[number];

/** Only what the card shows (MF-0021): no percent, no recall number, no count. */
export interface HeatmapRegion {
  domainCode: string;
  name: string;
  /** Healthy (other member, skill) pairs ÷ (other contributors × skills): under ⅓, ⅓ to under ⅔, ⅔ and up. */
  healthyBand: HealthyBand;
  status: HeatmapStatus;
}

/** Carries no member count in either state (C-3): a count tells who has played in a small group. */
export type GroupHeatmap =
  | { status: "not-enough-data" }
  | { status: "ready"; regions: HeatmapRegion[] };

/** One member's graded attempts and their own review context. Server-internal: never leaves `src/server/**`. */
export interface GroupMemberAttempts {
  attempts: readonly Attempt[];
  review: ReviewContext;
}

/** The read behind the heatmap: the viewer (null when they have no attempts) apart from the others. */
export interface GroupAttempts {
  viewer: GroupMemberAttempts | null;
  others: readonly GroupMemberAttempts[];
}

/** Decided on integers, so ⅓ and ⅔ land exactly on their band's lower edge (MF-0021 SC-2). */
function healthyBandOf(healthy: number, pairs: number): HealthyBand {
  if (3 * healthy < pairs) return "few";
  if (3 * healthy < 2 * pairs) return "some";
  return "most";
}

/** Holding vs fading on the whole-percent mean (MF-0011 N1 rule, kept by MF-0021 though the number is no longer shown). */
function statusOf(retrievabilityPercent: number | null): HeatmapStatus {
  if (retrievabilityPercent === null) return "no-data";
  return retrievabilityPercent >=
    Math.round(FOREST_THRESHOLDS.wiltBelowRetrievability * 100)
    ? "holding"
    : "fading";
}

/**
 * MF-0011: aggregate members' measured memory per region. Nothing per member is returned.
 * MF-0021 SC-7 (user, 2026-11-05): the gate AND the figures use the members other than the viewer.
 * `viewer` is taken and deliberately left out: pooling it let the viewer compare two loads around one
 * of their own answers and pin how many others have played.
 */
export function summarizeGroupHeatmap(input: {
  pack: Pack;
  viewer: ReadonlyMap<string, MemorySnapshot>;
  others: readonly ReadonlyMap<string, MemorySnapshot>[];
}): GroupHeatmap {
  const others = input.others.filter((m) => m.size > 0);
  if (others.length < MIN_OTHER_CONTRIBUTORS) {
    return { status: "not-enough-data" };
  }
  const regions = input.pack.domains.map((domain): HeatmapRegion => {
    let healthy = 0;
    let retrievabilitySum = 0;
    let remembered = 0;
    for (const memory of others) {
      for (const skill of domain.skills) {
        const snapshot = memory.get(skill.code) ?? null;
        const tree = treeStage(snapshot);
        if (tree.stage !== "seed" && !tree.wilting) healthy += 1;
        if (snapshot) {
          retrievabilitySum += snapshot.retrievability;
          remembered += 1;
        }
      }
    }
    const retrievabilityPercent =
      remembered > 0
        ? Math.round((retrievabilitySum / remembered) * 100)
        : null;
    return {
      domainCode: domain.code,
      name: domain.name,
      healthyBand: healthyBandOf(healthy, others.length * domain.skills.length),
      status: statusOf(retrievabilityPercent),
    };
  });

  return { status: "ready", regions };
}

/** MF-0011: each member's countable attempts → engine replay → the group heatmap. */
export function groupHeatmapFromAttempts(
  input: GroupAttempts & { pack: Pack; now: Date },
): GroupHeatmap {
  const replay = (m: GroupMemberAttempts) =>
    memoryBySkill(countableAttempts(m.attempts, m.review), input.now);
  return summarizeGroupHeatmap({
    pack: input.pack,
    // SC-7: the viewer never feeds the figures, so their attempts are not replayed
    viewer: new Map(),
    others: input.others.map(replay),
  });
}
