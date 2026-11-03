import type { GroupMember } from "@/server/groups/types";

export interface MemberListProps {
  members: GroupMember[];
  currentUserId: string;
}
