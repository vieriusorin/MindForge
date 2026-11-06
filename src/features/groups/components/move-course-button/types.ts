export interface MoveCourseButtonProps {
  groupId: string;
  /** The course the screen shows; a stale tab is refused by the database (40001). */
  fromPack: string;
  nextCourseName: string | null;
  /** Why the move can't happen (last course, course left the path), or null. */
  disabledReason: string | null;
  hasRunningExpedition: boolean;
}

export interface MoveDialogCopy {
  title: string;
  description: string;
}

export interface UseMoveCourseButtonReturn {
  move: () => void;
  /** True while moving and through the refresh after success, so nobody moves twice. */
  isPending: boolean;
  isDisabled: boolean;
  errorMessage: string | null;
  dialog: MoveDialogCopy;
}
