import type { NodeMode } from "@/engine/path";

/** MF-0062: what each node's link says it opens. */
export const NODE_MODE_LABEL = {
  plant: "Seed Planting",
  walk: "Daily Walk",
  duel: "Scenario Duel",
} as const satisfies Record<NodeMode, string>;

export interface StartNodeInput {
  packSlug: string;
  skillCode: string;
  mode: NodeMode;
}

/**
 * MF-0062: the start-node contract. The only place a course-map node becomes a URL; MF-0064 (lesson
 * player) changes the target here and nowhere else.
 */
export function startNodeHref({
  packSlug,
  skillCode,
  mode,
}: StartNodeInput): string {
  const base = `/play/${packSlug}`;
  if (mode === "plant") return `${base}/plant/${encodeURIComponent(skillCode)}`;
  return `${base}/${mode}`;
}

/**
 * MF-0062 review: the pack's Scenario Duel, for the done-state banner. Not a node, so it stays
 * outside the start-node contract that MF-0064 retargets.
 */
export function packDuelHref(packSlug: string): string {
  return `/play/${packSlug}/duel`;
}

/** MF-0062: a domain's Boss Storm checkpoint. */
export function bossStormHref({
  packSlug,
  domainCode,
}: {
  packSlug: string;
  domainCode: string;
}): string {
  return `/play/${packSlug}/storm/boss/${encodeURIComponent(domainCode)}`;
}
