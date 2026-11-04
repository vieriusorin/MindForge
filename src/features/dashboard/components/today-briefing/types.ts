import type { PackExamMeta } from "@/engine/pack";

export interface BriefingFocus {
  name: string;
  weight: number;
}

/** MF-0009: the briefing's one main action. Figures come from `planWalk`. */
export type BriefingWalk =
  | { isHealthy: true; duelHref: string }
  | {
      isHealthy: false;
      needWaterCount: number;
      stepCount: number;
      href: string;
    };

export interface TodayBriefingProps {
  grownSkills: number;
  totalSkills: number;
  grownPercent: number;
  topFocus: BriefingFocus | null;
  exam: PackExamMeta | undefined;
  groupCount: number;
  walk: BriefingWalk;
}

export interface WalkActionProps {
  walk: BriefingWalk;
}
