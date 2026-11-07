import { z } from "zod";
import { CUCKOO_MAX_LINES } from "@/engine/content";

/** MF-0016: one Spot the Cuckoo answer. The line is 1-based; the hash is the version the page showed (C-4). */
export const CuckooAnswerInput = z.strictObject({
  packSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  cuckooId: z.string().min(1).max(128),
  line: z.number().int().min(1).max(CUCKOO_MAX_LINES),
  contentHash: z.string().min(1).max(128),
  /** MF-0067: names this submission; a retry with the same id is recorded once. */
  clientAttemptId: z.uuid(),
});

export type CuckooAnswerValues = z.infer<typeof CuckooAnswerInput>;
