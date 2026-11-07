import type {
  ActionResult,
  FormActionResult,
  NoData,
} from "@/lib/action-result";
import type {
  CreateGroupValues,
  CreatePathGroupValues,
  DiscussionLinkFormValues,
} from "./schemas";

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

/** MF-0059: creating a group that follows a Group path. */
export type CreatePathGroupResult = FormActionResult<
  { groupId: string },
  CreatePathGroupValues
>;

/** MF-0059: joining through an invite; the hook navigates to `groupId`. */
export type JoinGroupResult = ActionResult<{ groupId: string }>;

/** MF-0059: the admin moving the group to the next course of its path. */
export type AdvanceGroupCourseResult = ActionResult;

/** MF-0063: the admin setting or clearing the group's discussion link. */
export type SetDiscussionLinkResult = FormActionResult<
  NoData,
  DiscussionLinkFormValues
>;
