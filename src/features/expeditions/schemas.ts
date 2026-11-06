import { z } from "zod";
import { EXPEDITION_TARGET } from "@/engine/expedition";

const TARGET_MESSAGE = `Pick a whole number from ${EXPEDITION_TARGET.min} to ${EXPEDITION_TARGET.max}.`;

/**
 * MF-0017: shared by the start form (zodResolver) and `startExpedition` (re-parse, the real
 * boundary). The database re-checks the domain against the group's pack and the target range.
 */
export const StartExpeditionInput = z.strictObject({
  groupId: z.uuid(),
  domainCode: z.string().trim().min(1, "Pick a domain.").max(32),
  target: z.coerce
    .number<string | number>(TARGET_MESSAGE)
    .int(TARGET_MESSAGE)
    .min(EXPEDITION_TARGET.min, TARGET_MESSAGE)
    .max(EXPEDITION_TARGET.max, TARGET_MESSAGE),
});

export type StartExpeditionValues = z.input<typeof StartExpeditionInput>;

/** MF-0059: `endExpedition`'s input. The DB checks the admin and that one is running. */
export const EndExpeditionInput = z.strictObject({ groupId: z.uuid() });
