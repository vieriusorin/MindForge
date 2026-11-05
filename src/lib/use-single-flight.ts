import { useRef } from "react";

export interface UseSingleFlightReturn {
  /** True when no flight is running (and starts one); false while one is. */
  tryStart: () => boolean;
  /** Ends the flight. Call it from the mutation's `onSettled`. */
  release: () => void;
}

/**
 * MF-0012 / MF-0026: TanStack reports `isPending` a render late, so two clicks before the re-render
 * both see `false` and the action runs twice (two attempts recorded). A ref closes that window
 * synchronously. Used by every practice mode that records an attempt per "Check answer".
 */
export function useSingleFlight(): UseSingleFlightReturn {
  const isInFlight = useRef(false);
  return {
    tryStart: () => {
      if (isInFlight.current) return false;
      isInFlight.current = true;
      return true;
    },
    release: () => {
      isInFlight.current = false;
    },
  };
}
