import type { RecentStorm, RecentStormRow } from "./types";

/** A finished storm row as the `RecentStorm` DTO; `finishedAt` is normalised to `toISOString` form. */
export function toRecentStorm(row: RecentStormRow): RecentStorm {
  return {
    id: row.id,
    kind: row.kind,
    domainCode: row.domain_code,
    finishedAt: new Date(row.finished_at).toISOString(),
    questions: row.storm_questions.map((q) => ({
      id: q.question_id,
      skillCode: q.skill_code,
      chosen: q.chosen,
      correct: q.correct,
      voided: q.voided,
    })),
  };
}
