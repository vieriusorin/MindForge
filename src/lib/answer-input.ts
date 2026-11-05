import { z } from "zod";

/**
 * MF-0009 / MF-0010: one practice answer. Option ids are single capital letters, as in the pack files.
 * MF-0032: `contentHash` is the version the page showed; grading refuses it when the item changed.
 */
export const AnswerInput = z.strictObject({
  packSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  questionId: z.string().min(1).max(128),
  chosen: z
    .array(z.string().regex(/^[A-Z]$/))
    .min(1)
    .max(10),
  contentHash: z.string().min(1).max(128),
});

export type AnswerValues = z.infer<typeof AnswerInput>;
