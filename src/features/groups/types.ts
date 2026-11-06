import type { ActionResult, FormActionResult } from "@/lib/action-result";
import type { CreateGroupValues } from "./schemas";

export type CreateGroupResult = FormActionResult<
  { groupId: string },
  CreateGroupValues
>;

/** MF-0054: `evicted` is the group whose pin was replaced to stay within 3, or null. */
export type PinGroupResult = ActionResult<{
  evicted: { id: string; name: string } | null;
}>;

export type UnpinGroupResult = ActionResult;

/** MF-0004: resetting the invite link; the error is the message the invite card shows. */
export type RotateInviteResult = ActionResult;
