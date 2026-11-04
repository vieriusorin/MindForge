import type { StormResult } from "@/engine/storm";
import type { StormResultRow } from "./types";

/** A finished storm row (with its embedded questions) as the engine's `StormResult`. */
export function toStormResult(row: StormResultRow): StormResult {
  return {
    kind: row.kind,
    finishedAt: new Date(row.finished_at),
    questions: row.storm_questions.map((q) => ({
      id: q.question_id,
      skillCode: q.skill_code,
      chosen: q.chosen,
      correct: q.correct,
      voided: q.voided,
    })),
  };
}
