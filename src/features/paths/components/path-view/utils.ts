import {
  type ForestView,
  STAGE_ORDER,
  summarizeForest,
  type TreeStage,
} from "@/engine/forest";
import type { CourseProgress } from "@/engine/path";
import { STAGE_LABEL } from "@/lib/forest-display";
import type { CourseStatus, PathCourseRow, StageCountPart } from "./types";

/** MF-0058 SC-7: every course carries its status as a word, never colour alone. */
export const STATUS_LABEL = {
  complete: "Complete",
  "in-progress": "In progress",
  "not-started": "Not started",
} as const satisfies Record<CourseStatus, string>;

export const STATUS_BADGE = {
  complete: "default",
  "in-progress": "secondary",
  "not-started": "outline",
} as const satisfies Record<CourseStatus, "default" | "secondary" | "outline">;

/** The row's stage tile: complete = every skill at Sapling, in progress = a skill past Seed. */
export const STATUS_STAGE = {
  complete: "sapling",
  "in-progress": "sprout",
  "not-started": "seed",
} as const satisfies Record<CourseStatus, TreeStage>;

/** The completion rule, in one sentence (SC-7). */
export const COMPLETION_RULE =
  "A course is complete when every skill in it reaches Sapling. MindForge records the date once; live health below can still fade.";

/**
 * MF-0058 review: the path is MindForge's, built from the Anthropic courses it has a pack for, so its
 * "Path complete" must never read as completing Anthropic's own path.
 */
export const SOURCE_NOTE =
  "Follows the order of an Anthropic Academy path, over the courses MindForge has a pack for. Completing it here is not a record on Anthropic's side.";

/** The link to the Anthropic path the order comes from. */
export const SOURCE_LINK_LABEL = "See the Anthropic path";

/** "k skills fading", or null when nothing is fading. */
export function fadingLabel(wiltingSkills: number): string | null {
  if (wiltingSkills === 0) return null;
  return wiltingSkills === 1
    ? "1 skill fading"
    : `${wiltingSkills} skills fading`;
}

/** "8 skills" / "1 skill". */
export function skillCountLabel(skillCount: number): string {
  return skillCount === 1 ? "1 skill" : `${skillCount} skills`;
}

/** The stages that have skills in them, in growth order, as "3 seed", "1 ancient tree". */
export function stageCountParts(
  stageCounts: Record<TreeStage, number>,
): StageCountPart[] {
  return STAGE_ORDER.filter((stage) => stageCounts[stage] > 0).map((stage) => ({
    stage,
    label: `${stageCounts[stage]} ${STAGE_LABEL[stage].toLowerCase()}`,
  }));
}

/**
 * MF-0058: the path's courses in order, joined with each course's live forest summary. Throws when a
 * course has no forest: the page reads one per course, so a gap is a bug, not an empty course.
 */
export function buildCourseRows(input: {
  courses: readonly CourseProgress[];
  forests: ReadonlyMap<string, ForestView>;
}): PathCourseRow[] {
  return input.courses.map((course, index) => {
    const forest = input.forests.get(course.packSlug);
    if (!forest)
      throw new Error(`buildCourseRows: no forest for ${course.packSlug}`);
    const summary = summarizeForest(forest);
    return {
      packSlug: course.packSlug,
      position: index + 1,
      name: forest.packName,
      status: course.status,
      completedAt: course.status === "complete" ? course.completedAt : null,
      skillCount: summary.totalSkills,
      stageCounts: summary.stageCounts,
      wiltingSkills: summary.wiltingSkills,
    };
  });
}
