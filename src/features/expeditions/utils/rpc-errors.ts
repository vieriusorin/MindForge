import { EXPEDITION_MIN_MEMBERS } from "@/engine/expedition";
import type { FormError } from "@/lib/action-result";
import type { StartExpeditionValues } from "../schemas";

/** The part of a PostgREST error we decide on. */
export interface RpcError {
  code?: string;
}

export const START_EXPEDITION_MESSAGES = {
  running: "An expedition is already running.",
  notAdmin: "Only the group admin can start an expedition.",
  tooSmall: `Expeditions need at least ${EXPEDITION_MIN_MEMBERS} members.`,
  domain: "Pick a domain from this group's pack.",
  unknown: "Couldn't start the expedition. Try again.",
} as const;

/**
 * MF-0017: map a start_expedition RPC error to what the form shows. SQLSTATEs from
 * private.start_expedition (supabase/migrations/20261105100000_mf0017_expeditions.sql):
 * 23P01 = one already active, 42501 = not the admin, P0001 = fewer than 4 members, 22023 = bad
 * domain or target (the schema already bounds the target, so it is the domain here).
 */
export function startExpeditionRpcError(
  error: RpcError,
): FormError<keyof StartExpeditionValues & string> {
  switch (error.code) {
    case "23P01":
      return { message: START_EXPEDITION_MESSAGES.running };
    case "42501":
      return { message: START_EXPEDITION_MESSAGES.notAdmin };
    case "P0001":
      return { message: START_EXPEDITION_MESSAGES.tooSmall };
    case "22023":
      return {
        message: START_EXPEDITION_MESSAGES.domain,
        fieldErrors: { domainCode: START_EXPEDITION_MESSAGES.domain },
      };
    default:
      return { message: START_EXPEDITION_MESSAGES.unknown };
  }
}

/**
 * MF-0059: map an end_expedition RPC error to the End button's message. SQLSTATEs from
 * private.end_expedition (supabase/migrations/20261106140000_mf0059_path_groups.sql):
 * 42501 = not the admin, P0002 = nothing running.
 */
export function endExpeditionRpcError(error: RpcError): string {
  switch (error.code) {
    case "42501":
      return "Only the group admin can end an expedition.";
    case "P0002":
      return "No expedition is running.";
    default:
      return "Couldn't end the expedition. Try again.";
  }
}
