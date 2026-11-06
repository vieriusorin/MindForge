import type { ReactNode } from "react";
import type { GroupCourseStep, PathContent } from "@/engine/path";

export interface PathCardViewInput {
  path: Pick<PathContent, "name" | "courses">;
  /** From `groupCourseStep`; null when the group's course left the path (C-3). */
  step: GroupCourseStep | null;
  /** Pack slug → pack name; a course without one is named by its slug. */
  packNames: Readonly<Record<string, string>>;
}

export interface PathCardRow {
  slug: string;
  name: string;
  isCurrent: boolean;
}

export type MoveDisabledReason =
  | "Last course of the path"
  | "This group's course isn't in the path any more";

export interface PathCardView {
  title: string;
  rows: readonly PathCardRow[];
  /** "Course n of N", or why there is no position. */
  positionLine: string;
  nextCourseName: string | null;
  moveDisabledReason: MoveDisabledReason | null;
}

export interface GroupPathCardProps {
  view: PathCardView;
  /** The admin's Move to next course button; absent for a member. */
  moveButton?: ReactNode;
}
