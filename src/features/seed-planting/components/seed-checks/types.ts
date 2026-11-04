import type { PlayableQuestion } from "@/engine/questions";

export interface SeedChecksProps {
  packSlug: string;
  checks: PlayableQuestion[];
  /** The skill had no successful recall before this visit (`treeStage` = seed). */
  wasSeed: boolean;
  forestHref: string;
}

/** How the visit ends, from what the database graded (MINDFORGE §4 game honesty). */
export type PlantingOutcome = "sprouted" | "still-seed" | "recorded";
