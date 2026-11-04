import { Timer } from "lucide-react";
import type { StormCountdownProps } from "../types";

/**
 * The storm clock. `role="timer"` is not live (it would speak every second); a separate polite
 * region speaks only at 5 min, 1 min and the end.
 */
export function StormCountdown({ label, announcement }: StormCountdownProps) {
  return (
    <div className="flex items-center gap-2">
      <Timer aria-hidden className="size-5 text-primary" />
      <span className="sr-only">Time left</span>
      <span
        role="timer"
        aria-live="off"
        aria-atomic="true"
        className="text-2xl font-semibold tabular-nums"
      >
        {label}
      </span>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
