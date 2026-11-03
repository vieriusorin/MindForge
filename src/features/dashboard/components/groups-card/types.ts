import type { MyGroup } from "@/server/groups/types";

export interface GroupsCardProps {
  groups: MyGroup[];
  packNames: Record<string, string>;
}
