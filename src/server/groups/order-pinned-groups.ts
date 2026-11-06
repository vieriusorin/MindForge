import type { GroupPin } from "./types";

/**
 * MF-0054: the pinned groups, newest pin first. Pins sort by (pinnedAt, groupId) descending, the same
 * total order the DB evicts by (least first). A pin whose group is not in `groups` is dropped.
 */
export function orderPinnedGroups<T extends { id: string }>({
  groups,
  pins,
}: {
  groups: readonly T[];
  pins: readonly GroupPin[];
}): T[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  return [...pins]
    .sort((a, b) => {
      const at = Date.parse(b.pinnedAt) - Date.parse(a.pinnedAt);
      if (at !== 0) return at;
      if (a.groupId === b.groupId) return 0;
      return a.groupId < b.groupId ? 1 : -1;
    })
    .flatMap((p) => {
      const group = byId.get(p.groupId);
      return group ? [group] : [];
    });
}
