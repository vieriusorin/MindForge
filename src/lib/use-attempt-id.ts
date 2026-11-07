import { useRef } from "react";
import { attemptIdFor, type HeldAttemptId } from "./attempt-id";

export interface UseAttemptIdReturn {
  /** The id to send with this submission: kept for a retry of the same one, new for any other. */
  idFor: (submission: string) => string;
  /** Forget the held id (call on "Next"), so a later identical submission is a new attempt. */
  clear: () => void;
}

/**
 * MF-0067: the client attempt id for the practice modes. A ref, not state: nothing renders from it,
 * and a retry click must read the id synchronously (the same reason as `useSingleFlight`).
 */
export function useAttemptId(): UseAttemptIdReturn {
  const held = useRef<HeldAttemptId | null>(null);
  return {
    idFor: (submission) => {
      held.current = attemptIdFor({
        held: held.current,
        submission,
        mint: () => crypto.randomUUID(),
      });
      return held.current.id;
    },
    clear: () => {
      held.current = null;
    },
  };
}
