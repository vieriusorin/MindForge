import type { OpenFlag } from "@/server/review/types";
import type { FlaggedItem } from "./types";

/** One entry per flagged item, in the order its first open flag arrived; flags keep their order. */
export function groupFlagsByItem(flags: readonly OpenFlag[]): FlaggedItem[] {
  const byItem = new Map<string, OpenFlag[]>();
  for (const flag of flags) {
    const list = byItem.get(flag.itemId);
    if (list) list.push(flag);
    else byItem.set(flag.itemId, [flag]);
  }
  return [...byItem].map(([itemId, list]) => ({ itemId, flags: list }));
}
