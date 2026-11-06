import { orderPinnedGroups } from "@/server/groups/order-pinned-groups";
import type { GroupPin } from "@/server/groups/types";

/** The pack shown when a learner has no group yet. */
export const DEFAULT_PACK_SLUG = "ccdv-f";

/**
 * MF-0054 SC-2 (C-1): with pins, the most recently pinned group's pack; else the newest-joined group's
 * pack (`groups` arrive joined_at desc); else the default pack.
 */
export function primaryPackSlug({
  groups,
  pins,
}: {
  groups: readonly { id: string; packSlug: string }[];
  pins: readonly GroupPin[];
}): string {
  const [newestPin] = orderPinnedGroups({ groups, pins });
  return newestPin?.packSlug ?? groups[0]?.packSlug ?? DEFAULT_PACK_SLUG;
}
