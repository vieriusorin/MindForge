import type { UsePinTogglePinnedGroup } from "./types";

/** MF-0054 user decision 2: the UI says which group lost its pin to make room. */
export function evictionMessage(
  evicted: UsePinTogglePinnedGroup | null,
): string | null {
  return evicted ? `Unpinned "${evicted.name}" to make room.` : null;
}
