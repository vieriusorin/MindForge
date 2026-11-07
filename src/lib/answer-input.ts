import { z } from "zod";
import { CONFIDENCES } from "@/engine/memory";

/**
 * MF-0009 / MF-0010: one practice answer. Option ids are single capital letters, as in the pack files.
 * MF-0032: `contentHash` is the version the page showed; grading refuses it when the item changed.
 * MF-0067: `clientAttemptId` names this submission; a retry with the same id is recorded once.
 * MF-0065: `confidence` is the optional tap before the reveal (ADR 0007); absent = no tap.
 */
export const AnswerInput = z.strictObject({
  packSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  questionId: z.string().min(1).max(128),
  chosen: z
    .array(z.string().regex(/^[A-Z]$/))
    .min(1)
    .max(10),
  contentHash: z.string().min(1).max(128),
  clientAttemptId: z.uuid(),
  confidence: z.enum(CONFIDENCES).optional(),
});

export type AnswerValues = z.infer<typeof AnswerInput>;
