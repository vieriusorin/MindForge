import type { MyGroup } from "@/server/groups/types";

export interface GroupListProps {
  groups: MyGroup[];
  packNames: Record<string, string>;
}
