import type { WalkStep } from "../../types";

export interface WalkSessionProps {
  packSlug: string;
  steps: WalkStep[];
  skillNames: Record<string, string>;
  todayHref: string;
  duelHref: string;
}
