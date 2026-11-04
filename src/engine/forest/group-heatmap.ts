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

export interface HeatmapRegion {
  domainCode: string;
  name: string;
  /** Healthy (member, skill) pairs ÷ (contributors × skills in the region), whole percent. */
  healthyPercent: number;
  /** Mean retrievability over the (member, skill) pairs that have memory, whole percent; null when none. */
  retrievabilityPercent: number | null;
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

const percent = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

/** Holding vs fading, decided on the SHOWN whole percent so the word never contradicts the number. */
function statusOf(retrievabilityPercent: number | null): HeatmapStatus {
  if (retrievabilityPercent === null) return "no-data";
  return retrievabilityPercent >=
    Math.round(FOREST_THRESHOLDS.wiltBelowRetrievability * 100)
    ? "holding"
    : "fading";
}

/**
 * MF-0011: aggregate members' measured memory per region. The gate counts contributors other than
 * the viewer; the figures pool every contributor, the viewer included. Nothing per member is returned.
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
  const contributors =
    input.viewer.size > 0 ? [input.viewer, ...others] : others;

  const regions = input.pack.domains.map((domain): HeatmapRegion => {
    let healthy = 0;
    let retrievabilitySum = 0;
    let remembered = 0;
    for (const memory of contributors) {
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
      healthyPercent: percent(
        healthy,
        contributors.length * domain.skills.length,
      ),
      retrievabilityPercent,
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
    viewer: input.viewer ? replay(input.viewer) : new Map(),
    others: input.others.map(replay),
  });
}
