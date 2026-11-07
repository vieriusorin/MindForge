import type { FormError } from "@/lib/action-result";
import {
  type CreateGroupValues,
  type CreatePathGroupValues,
  DISCUSSION_URL_MESSAGE,
  type DiscussionLinkFormValues,
} from "../schemas";

/** The part of a PostgREST error we decide on. */
export interface RpcError {
  code?: string;
}

/**
 * The cap enforced by private.create_group (MF-0004): `v_max_groups` in
 * supabase/migrations/20261103150000_mf0004_create_group_guards.sql. Shown to the user, decided
 * by the DB, so change both together.
 */
export const MAX_GROUPS_PER_USER = 10;

/**
 * MF-0004: map a create_group RPC error to what the form shows. The SQLSTATEs are raised by
 * private.create_group: 22023 = unknown pack, 54000 = group limit reached.
 */
export function createGroupRpcError(
  error: RpcError,
): FormError<keyof CreateGroupValues & string> {
  switch (error.code) {
    case "22023":
      return {
        message: "Pick a learning pack.",
        fieldErrors: { packSlug: "Pick a learning pack." },
      };
    case "54000":
      return {
        message: `You can create up to ${MAX_GROUPS_PER_USER} groups.`,
      };
    default:
      return { message: "Could not create the group. Try again." };
  }
}

/** MF-0004: map a rotate_invite_code RPC error to the invite card's message. 42501 = not admin. */
export function rotateInviteRpcError(error: RpcError): string {
  return error.code === "42501"
    ? "Only the group admin can reset the link."
    : "Could not reset the link. Try again.";
}

/** MF-0054: map a pin_group / unpin_group RPC error to the toggle's message. 42501 = not a member. */
export function pinRpcError(error: RpcError): string {
  return error.code === "42501"
    ? "You can only pin groups you belong to."
    : "Could not update your pins. Try again.";
}

/**
 * MF-0059: map a create_path_group RPC error to what the form shows. SQLSTATEs from
 * private.create_path_group (supabase/migrations/20261106140000_mf0059_path_groups.sql):
 * 22023 = unknown path, 54000 = group limit reached.
 */
export function createPathGroupRpcError(
  error: RpcError,
): FormError<keyof CreatePathGroupValues & string> {
  switch (error.code) {
    case "22023":
      return {
        message: "Pick a path.",
        fieldErrors: { pathSlug: "Pick a path." },
      };
    case "54000":
      return {
        message: `You can create up to ${MAX_GROUPS_PER_USER} groups.`,
      };
    default:
      return { message: "Could not create the group. Try again." };
  }
}

/** MF-0059: map a join_group RPC error to the join card's message. P0002 = invalid or reset code. */
export function joinGroupRpcError(error: RpcError): string {
  return error.code === "P0002"
    ? "This invite link is invalid or has been reset. Ask a group member for a new one."
    : "Could not join the group. Try again.";
}

/**
 * MF-0059: map an advance_group_course RPC error to the Move button's message. 42501 = not the
 * admin, 40001 = the group moved since the screen rendered, P0001 = no path or no next course.
 */
export function advanceGroupCourseRpcError(error: RpcError): string {
  switch (error.code) {
    case "42501":
      return "Only the group admin can move the group to the next course.";
    case "40001":
      return "The group has already moved. Refresh to see its course.";
    case "P0001":
      return "This group has no next course to move to.";
    default:
      return "Could not move the group. Try again.";
  }
}

/**
 * MF-0063: map a set_group_discussion_url RPC error to what the link form shows. SQLSTATEs from
 * private.set_group_discussion_url (20261106160000_mf0063_discussion_link.sql): 42501 = not the
 * group admin (or not signed in), 23514 = the link fails the CHECK.
 */
export function discussionLinkRpcError(
  error: RpcError,
): FormError<keyof DiscussionLinkFormValues & string> {
  switch (error.code) {
    case "42501":
      return {
        message: "Only the group admin can change the discussion link.",
      };
    case "23514":
      return {
        message: DISCUSSION_URL_MESSAGE,
        fieldErrors: { url: DISCUSSION_URL_MESSAGE },
      };
    default:
      return { message: "Could not save the link. Try again." };
  }
}
