import type { PendingAnalogy } from "@/server/review/types";

export interface PendingAnalogyListProps {
  analogies: readonly PendingAnalogy[];
  /** Item id → the card's concept. */
  titles: Readonly<Record<string, string>>;
  /** Item id → hash of the deployed file. */
  contentHashes: Readonly<Record<string, string>>;
}
