import type { GeneratedBy, ItemLevel, Origin } from "../content/types";

export interface QuestionOption {
  id: string;
  text: string;
  correct: boolean;
  rationale: string;
}

export interface Question {
  id: string;
  skillCode: string;
  origin: Origin;
  /** sign-in email; absent for official items. Never sent to the browser (PII). */
  author?: string;
  /** MF-0008: model + prompt version of an `ai` item, written by the pipeline. Never sent to the browser. */
  generatedBy?: GeneratedBy;
  level?: ItemLevel;
  stem: string;
  select: number;
  options: QuestionOption[];
  source: { title: string; url: string };
}

/** What the browser may see before answering: no correctness, no rationale, no author. */
export interface PlayableQuestion {
  id: string;
  skillCode: string;
  origin: Origin;
  stem: string;
  select: number;
  options: { id: string; text: string }[];
  source: { title: string; url: string };
  /** MF-0032: the deployed file's hash of this question; the answer sends it back (version read). */
  contentHash: string;
}

/** Revealed only after the database graded the answer: the key and every option's rationale. */
export interface AnswerFeedback {
  correct: boolean;
  correctOptionIds: string[];
  rationales: Record<string, string>;
}

export interface QuestionFile {
  name: string;
  text: string;
}
