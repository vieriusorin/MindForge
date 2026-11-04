import type { StartStormError } from "@/server/storm/start-storm";
import type { StormActionError } from "../types";

/** The part of a PostgREST error we decide on. */
export interface RpcError {
  code?: string;
}

/** MF-0013: why `startStormFor` refused, worded for the start screen. */
export const START_MESSAGE = {
  "no-questions":
    "There are no questions you haven't reviewed left for this storm.",
  "already-running": "You already have a storm running. Finish it first.",
  "content-changed":
    "The questions changed while the storm was being prepared. Try again.",
  "not-ready": "This storm isn't available for this pack yet.",
} as const satisfies Record<StartStormError, string>;

/** SQLSTATEs raised by answer_storm_question / finish_storm (supabase/migrations/*_mf0013_storms.sql). */
const RPC_MESSAGE: Readonly<Record<string, string>> = {
  MF013: "Time is up: this storm has ended.",
  "55000": "This question changed during the storm; it will not count.",
  "42501": "This storm isn't yours.",
  "22023": "That answer isn't valid for this question.",
  P0002: "That question isn't part of this storm.",
};

const FALLBACK_MESSAGE = "Could not save. Try again.";

/** MF-0013: map a storm RPC error to the session's message; MF013 (deadline passed) locks it. */
export function stormRpcError(error: RpcError): StormActionError {
  const code = error.code ?? "";
  return {
    message: RPC_MESSAGE[code] ?? FALLBACK_MESSAGE,
    isStormOver: code === "MF013",
  };
}
