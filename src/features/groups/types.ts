import type { ActionResult, FormActionResult } from "@/lib/action-result";
import type { FormActionResult } from "@/lib/action-result";
import type { CreateGroupValues } from "./schemas";

export type CreateGroupResult = FormActionResult<
  { groupId: string },
  CreateGroupValues
>;

export type RotateInviteResult = ActionResult;
