import type { ReactNode } from "react";
import type { TreeStage } from "@/engine/forest";
import type { CourseProgress, PathProgress } from "@/engine/path";

export type CourseStatus = CourseProgress["status"];

/** One course of the path as the page shows it. Every figure comes from `summarizeForest`. */
export interface PathCourseRow {
  packSlug: string;
  /** 1-based place in path order. */
  position: number;
  name: string;
  status: CourseStatus;
  /** ISO timestamp of the recorded Course complete, or null. */
  completedAt: string | null;
  skillCount: number;
  stageCounts: Record<TreeStage, number>;
  wiltingSkills: number;
}

export interface StageCountPart {
  stage: TreeStage;
  label: string;
}

export interface PathViewProps {
  name: string;
  source: string;
  isEnrolled: boolean;
  progress: PathProgress;
  courses: readonly PathCourseRow[];
  /** Start path, or the path menu (Leave) once enrolled. */
  actions: ReactNode;
}

export interface CourseRowProps {
  course: PathCourseRow;
  /** Live health (stage counts, fading) shows once the learner is enrolled. */
  showHealth: boolean;
}
