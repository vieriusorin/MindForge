import type { ActionResult, FormActionResult } from "@/lib/action-result";
import type { CreateGroupValues } from "./schemas";

export type CreateGroupResult = FormActionResult<
  { groupId: string },
  CreateGroupValues
>;

/** MF-0004: resetting the invite link; the error is the message the invite card shows. */
export type RotateInviteResult = ActionResult;
