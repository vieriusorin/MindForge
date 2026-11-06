import { z } from "zod";

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

/** MF-0054: one of the viewer's own pins (private.group_pins via public.list_my_pins). `pinnedAt` is ISO. */
export interface GroupPin {
  groupId: string;
  pinnedAt: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  packSlug: string;
  inviteCode: string;
  createdBy: string;
  /** MF-0059: the Group path this group follows, or null for a pack-only group. */
  pathSlug: string | null;
}

/** MF-0059: what the join page shows before the user joins. */
export interface InvitePreview {
  name: string;
  pathSlug: string | null;
}

export interface GroupMember {
  userId: string;
  displayName: string;
  role: GroupRole;
}

/**
 * MF-0011: `public.group_attempts` rows: one per member (opaque key, never a user id; `is_viewer`
 * marks the viewer), the member's attempts on the group's pack as jsonb. Server-internal; parsed here at the boundary.
 */
export const GroupAttemptRows = z.array(
  z.object({
    member_key: z.number(),
    is_viewer: z.boolean(),
    attempts: z.array(
      z.object({
        question_id: z.string(),
        skill_code: z.string(),
        correct: z.boolean(),
        answered_at: z.iso.datetime({ offset: true }),
        rejected: z.boolean(),
        spoiled_at: z.iso.datetime({ offset: true }).nullable(),
      }),
    ),
  }),
);
