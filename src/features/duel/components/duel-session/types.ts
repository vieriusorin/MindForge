import type { PlayableQuestion } from "@/engine/questions";
import type { DuelBackLink } from "../../types";

export interface DuelSessionProps {
  packSlug: string;
  questions: PlayableQuestion[];
  skillNames: Record<string, string>;
  back: DuelBackLink;
}
