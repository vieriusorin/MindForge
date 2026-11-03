import type { PlayableQuestion } from "@/engine/questions";

export interface DuelSessionProps {
  packSlug: string;
  questions: PlayableQuestion[];
  skillNames: Record<string, string>;
  backHref: string;
}
