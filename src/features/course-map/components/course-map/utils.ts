import type { CourseMap, CourseMapDomain, CourseMapNode } from "@/engine/path";
import type { StepMarker } from "./types";

/** MF-0062: the word on the node the next step points at (status is never colour alone). */
export const STEP_MARKER = {
  water: "Water first",
  next: "Next",
} as const satisfies Record<"water" | "next", StepMarker>;

/** The marker for one node, or null when the next step points elsewhere (or nowhere). */
export function stepMarker(
  next: CourseMap["next"],
  skillCode: string,
): StepMarker | null {
  if (next.kind === "done" || next.skillCode !== skillCode) return null;
  return STEP_MARKER[next.kind];
}

/** The node the next step points at, or null when every skill is done. */
export function findNextNode(map: CourseMap): CourseMapNode | null {
  const { next } = map;
  if (next.kind === "done") return null;
  for (const domain of map.domains) {
    const node = domain.nodes.find((n) => n.skillCode === next.skillCode);
    if (node) return node;
  }
  return null;
}

/** "k of n at Sapling": a domain's (or the map's) done figure, from the engine counts. */
export function atSaplingLine(doneCount: number, skillCount: number): string {
  return `${doneCount} of ${skillCount} at Sapling`;
}

/** "k skills fading", or null when nothing is fading. */
export function fadingLine(wiltingSkills: number): string | null {
  if (wiltingSkills === 0) return null;
  return wiltingSkills === 1
    ? "1 skill fading"
    : `${wiltingSkills} skills fading`;
}

/**
 * The domain header's figure: shown only when the domain has no checkpoint, because an exam pack's
 * checkpoint row already carries it.
 */
export function domainHeaderLine(
  domain: Pick<CourseMapDomain, "checkpoint" | "doneCount" | "skillCount">,
): string | null {
  return domain.checkpoint === null
    ? atSaplingLine(domain.doneCount, domain.skillCount)
    : null;
}

/**
 * Why the next step is what it is, in one sentence. MF-0062 review: the water line must not promise
 * the walk contains this skill (`planWalk` ranks by weight × (1 − R) and caps at 10); MF-0064's
 * skill-scoped lesson closes that gap.
 */
export function nextStepReason(kind: "water" | "next"): string {
  return kind === "water"
    ? "This skill is fading. Recall it soon to keep it growing: the Daily Walk starts with fading skills."
    : "The next skill to grow on this map.";
}
