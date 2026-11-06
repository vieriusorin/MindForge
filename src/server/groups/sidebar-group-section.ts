import { orderPinnedGroups } from "./order-pinned-groups";
import type { GroupPin } from "./types";

/** MF-0054: the sidebar's group section title. */
export type SidebarSectionLabel = "Pinned" | "Recent";

export interface SidebarGroupSection<T> {
  label: SidebarSectionLabel;
  groups: T[];
}

/** Without pins, the sidebar shows this many of the newest-joined groups (user decision 1). */
export const RECENT_GROUPS = 3;

/**
 * MF-0054 SC-1: no groups → null; no (visible) pins → "Recent" + the 3 newest-joined (`groups` arrive
 * joined_at desc); pins → "Pinned" + only the pinned groups, newest pin first.
 */
export function sidebarGroupSection<T extends { id: string }>({
  groups,
  pins,
}: {
  groups: readonly T[];
  pins: readonly GroupPin[];
}): SidebarGroupSection<T> | null {
  if (groups.length === 0) return null;
  const pinned = orderPinnedGroups({ groups, pins });
  if (pinned.length > 0) return { label: "Pinned", groups: pinned };
  return { label: "Recent", groups: groups.slice(0, RECENT_GROUPS) };
}
