/**
 * MF-0059 C-1: an expedition counts in the pack it started in. Once ended, a pack other than the group's
 * current course means the admin moved the group on (only a move changes a group's pack).
 */
export function isEndedByCourseMove(input: {
  readonly expeditionPack: string;
  readonly currentPack: string;
  readonly isActive: boolean;
}): boolean {
  return !input.isActive && input.expeditionPack !== input.currentPack;
}
