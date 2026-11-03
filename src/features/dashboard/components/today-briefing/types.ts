import type { PackExamMeta } from "@/engine/pack";

export interface BriefingFocus {
  name: string;
  weight: number;
}

export interface TodayBriefingProps {
  grownSkills: number;
  totalSkills: number;
  grownPercent: number;
  topFocus: BriefingFocus | null;
  exam: PackExamMeta | undefined;
  groupCount: number;
}
