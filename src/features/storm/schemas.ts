import { z } from "zod";
import { STORM_KINDS } from "@/engine/storm";

/** MF-0013: which storm to start. A Boss Storm names its domain; a Full Storm never does. */
export const StartStormInput = z
  .strictObject({
    packSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    kind: z.enum(STORM_KINDS),
    domainCode: z.string().min(1).max(32).nullable(),
  })
  .refine((v) => (v.kind === "boss") === (v.domainCode !== null), {
    message: "A Boss Storm needs a domain; a Full Storm has none.",
    path: ["domainCode"],
  });
export type StartStormValues = z.infer<typeof StartStormInput>;

/**
 * MF-0013: one saved (ungraded) storm answer, bound to the content hash the learner read.
 * An empty `chosen` clears the stored answer (the learner unticked below `select` picks).
 */
export const AnswerStormInput = z.strictObject({
  stormId: z.uuid(),
  questionId: z.string().min(1).max(128),
  chosen: z.array(z.string().regex(/^[A-Z]$/)).max(10),
  contentHash: z.string().min(1).max(128),
});
export type AnswerStormValues = z.infer<typeof AnswerStormInput>;

export const FinishStormInput = z.strictObject({ stormId: z.uuid() });
export type FinishStormValues = z.infer<typeof FinishStormInput>;
