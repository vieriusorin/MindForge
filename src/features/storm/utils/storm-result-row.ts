import type {
  StormQuestionRow,
  StormResultRow,
  StormSummary,
} from "@/server/storm/types";

/**
 * MF-0013: a finished storm's header and question rows in the shape `toStormResult` reads, so
 * the report scores exactly what the database graded.
 */
export function toStormResultRow(
  storm: Pick<StormSummary, "kind">,
  finishedAt: string,
  rows: readonly StormQuestionRow[],
): StormResultRow {
  return {
    kind: storm.kind,
    finished_at: finishedAt,
    storm_questions: rows.map((r) => ({
      position: r.position,
      question_id: r.questionId,
      skill_code: r.skillCode,
      chosen: r.chosen === null ? null : [...r.chosen],
      correct: r.correct,
      voided: r.voided,
    })),
  };
}
