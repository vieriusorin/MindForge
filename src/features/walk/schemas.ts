import { z } from "zod";

/** MF-0009: one walk answer. Option ids are single capital letters, as in the pack files. */
export const AnswerWalkInput = z.strictObject({
  packSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  questionId: z.string().min(1).max(128),
  chosen: z
    .array(z.string().regex(/^[A-Z]$/))
    .min(1)
    .max(10),
});

export type AnswerWalkValues = z.infer<typeof AnswerWalkInput>;
