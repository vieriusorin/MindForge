import type { ReactNode } from "react";
import type { WalkStep } from "../../types";

export interface WalkSessionProps {
  packSlug: string;
  steps: WalkStep[];
  skillNames: Record<string, string>;
  todayHref: string;
  duelHref: string;
  /** MF-0010 (C-4): the new skill's card + diagram, shown above its question. */
  newSeedPrimer?: ReactNode;
}
