import type { OpenFlag } from "@/server/review/types";

export interface FlagQueueProps {
  flags: readonly OpenFlag[];
  /** Item id → the line a maintainer recognises it by (stem, concept, title). */
  titles: Readonly<Record<string, string>>;
  /** Item id → hash of the deployed file (the version a decision applies to). */
  contentHashes: Readonly<Record<string, string>>;
}

export interface FlaggedItem {
  itemId: string;
  flags: OpenFlag[];
}

export interface ItemDecisionProps {
  itemId: string;
  /** Undefined when the deployed files lack the item (registry ahead of a deploy). */
  contentHash: string | undefined;
}

export interface FlagRowProps {
  flag: OpenFlag;
}
