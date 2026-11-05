import type { RefObject } from "react";
import type { CuckooFeedback, PlayableCuckoo } from "@/engine/content";
import type { CuckooBackLink } from "../../types";

export interface CuckooSessionProps {
  packSlug: string;
  cuckoos: PlayableCuckoo[];
  skillNames: Record<string, string>;
  back: CuckooBackLink;
}

export interface SnippetLinesProps {
  cuckooId: string;
  lines: string[];
  chosenLine: number | null;
  feedback: CuckooFeedback | null;
  isLocked: boolean;
  /** Names the radio group (the snippet's title). */
  labelledBy: string;
  onChoose: (line: number) => void;
}

export interface CuckooFeedbackProps {
  feedback: CuckooFeedback;
}

export interface RoundFinishedProps {
  score: number;
  answered: number;
  back: CuckooBackLink;
  doneRef: RefObject<HTMLHeadingElement | null>;
}
