import { z } from "zod";
import type { PlayableQuestion } from "@/engine/questions";
import { STORM_KINDS, type StormKind } from "@/engine/storm";

/** A storm's header: what it is and its DB-owned clock. Carries no score and no key. */
export interface StormSummary {
  readonly id: string;
  readonly packSlug: string;
  readonly kind: StormKind;
  /** Boss Storm only. */
  readonly domainCode: string | null;
  /** ISO 8601, set by the database. */
  readonly startedAt: string;
  /** ISO 8601 deadline, set by the database; answers at or after it are refused. */
  readonly endsAt: string;
  readonly finishedAt: string | null;
}

/** One question of a storm as stored. `correct` stays null until the storm is finished (SC-4). */
export interface StormQuestionRow {
  readonly questionId: string;
  readonly skillCode: string;
  readonly domainCode: string;
  readonly position: number;
  /** The content hash the storm started with: every answer must name it. */
  readonly contentHash: string;
  readonly unreviewed: boolean;
  readonly chosen: readonly string[] | null;
  readonly correct: boolean | null;
  readonly voided: boolean;
}

/** SC-4: what a running storm sends to the browser per question. No key, no rationale, no author. */
export interface StormSessionQuestion {
  readonly question: PlayableQuestion;
  readonly contentHash: string;
  readonly chosen: readonly string[] | null;
  readonly unreviewed: boolean;
}

export const STORM_SUMMARY_COLUMNS =
  "id, pack_slug, kind, domain_code, started_at, ends_at, finished_at";

export const StormSummaryRow = z.object({
  id: z.string(),
  pack_slug: z.string(),
  kind: z.enum(STORM_KINDS),
  domain_code: z.string().nullable(),
  started_at: z.string(),
  ends_at: z.string(),
  finished_at: z.string().nullable(),
});
export type StormSummaryRow = z.infer<typeof StormSummaryRow>;

export const StormQuestionDbRows = z.array(
  z.object({
    question_id: z.string(),
    skill_code: z.string(),
    domain_code: z.string(),
    position: z.number().int(),
    content_hash: z.string(),
    unreviewed: z.boolean(),
    chosen: z.array(z.string()).nullable(),
    correct: z.boolean().nullable(),
    voided: z.boolean(),
  }),
);

export const StormResultRow = z.object({
  kind: z.enum(STORM_KINDS),
  finished_at: z.string(),
  storm_questions: z.array(
    z.object({
      position: z.number().int(),
      question_id: z.string(),
      skill_code: z.string(),
      chosen: z.array(z.string()).nullable(),
      correct: z.boolean().nullable(),
      voided: z.boolean(),
    }),
  ),
});
export type StormResultRow = z.infer<typeof StormResultRow>;

/** A uuid guard for ids that arrive from a URL: an invalid one is "not found", not a DB error. */
export const StormId = z.uuid();
