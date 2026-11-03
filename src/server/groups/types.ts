export type GroupRole = "admin" | "member";

const ROLES = ["admin", "member"] as const satisfies readonly GroupRole[];

/** The DB enforces the role with a CHECK constraint; narrow it at the boundary. */
export function toGroupRole(value: string): GroupRole {
  const role = ROLES.find((r) => r === value);
  if (!role) throw new Error(`unexpected group role "${value}"`);
  return role;
}

export interface MyGroup {
  id: string;
  name: string;
  packSlug: string;
  role: GroupRole;
}

export interface GroupDetail {
  id: string;
  name: string;
  packSlug: string;
  inviteCode: string;
  createdBy: string;
}

export interface GroupMember {
  userId: string;
  displayName: string;
  role: GroupRole;
}
