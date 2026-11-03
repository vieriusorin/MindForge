export type QuestionStatus = "official" | "unreviewed";

export interface QuestionOption {
  id: string;
  text: string;
  correct: boolean;
  rationale: string;
}

export interface Question {
  id: string;
  skillCode: string;
  status: QuestionStatus;
  stem: string;
  select: number;
  options: QuestionOption[];
  source: { title: string; url: string };
}

/** What the browser may see before answering: no correctness, no rationale. */
export interface PlayableQuestion {
  id: string;
  skillCode: string;
  status: QuestionStatus;
  stem: string;
  select: number;
  options: { id: string; text: string }[];
  source: { title: string; url: string };
}

export interface QuestionFile {
  name: string;
  text: string;
}
