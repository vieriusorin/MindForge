import type { Diagram, NatureCard } from "@/engine/content";
import type { AnswerFeedback } from "@/engine/questions";
import type { ActionResult } from "@/lib/action-result";

/** What the screen shows of a card: never `author` (an email, PII) or review metadata. */
export type NatureCardContent = Pick<
  NatureCard,
  | "id"
  | "concept"
  | "simply"
  | "inNature"
  | "whereItBreaks"
  | "contrast"
  | "whyTheName"
  | "sources"
>;

export type DiagramContent = Pick<
  Diagram,
  "id" | "title" | "direction" | "nodes" | "edges"
>;

export type AnswerSeedCheckResult = ActionResult<{ feedback: AnswerFeedback }>;
