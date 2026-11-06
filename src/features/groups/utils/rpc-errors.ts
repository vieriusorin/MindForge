import type { FormError } from "@/lib/action-result";
import type { CreateGroupValues } from "../schemas";

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
