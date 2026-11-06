import type { MyGroup } from "@/server/groups/types";

export interface GroupListProps {
  groups: MyGroup[];
  packNames: Record<string, string>;
  /** MF-0054: the viewer's pinned groups; each row gets a pin toggle. */
  pinnedGroupIds: readonly string[];
}
