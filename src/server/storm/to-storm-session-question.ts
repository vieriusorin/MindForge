import { type Question, toPlayableQuestion } from "@/engine/questions";
import type { StormQuestionRow, StormSessionQuestion } from "./types";

/**
 * MF-0013 SC-4: the per-question payload of a running storm. An allow-list: the playable question
 * (no key, rationale or author), the stored, ungraded answer, and `readHash`: the hash of the
 * DEPLOYED file the page renders (`getItemHashes`), never the hash stored at start. The answer
 * names the version the learner read, so the DB refuses it (55000) when that differs from the
 * version the storm was composed from (MF-0013 review).
 */
export function toStormSessionQuestion(
  question: Question,
  row: Pick<StormQuestionRow, "chosen" | "unreviewed">,
  readHash: string,
): StormSessionQuestion {
  return {
    question: toPlayableQuestion(question, readHash),
    contentHash: readHash,
    chosen: row.chosen,
    unreviewed: row.unreviewed,
  };
}
