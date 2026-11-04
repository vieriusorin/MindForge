import "server-only";
import {
  type CuckooFeedback,
  type CuckooGradeError,
  checkCuckooAnswer,
  reviewStateOf,
} from "@/engine/content";
import type { ActionResult } from "@/lib/action-result";
import { getItemHashes } from "@/server/content/get-item-hashes";
import { getPackContent } from "@/server/content/get-pack-content";
import { getReviewContext } from "@/server/content/get-review-context";
import { createServerSupabase } from "@/server/supabase/server";

export type GradeCuckooError = CuckooGradeError | "not-gradable";

export interface GradeCuckooInput {
  userId: string;
  packSlug: string;
  cuckooId: string;
  line: number;
  contentHash: string;
}

/**
 * MF-0016: grade one Spot the Cuckoo answer in the DATABASE (`record_attempt`, the line number as the
 * only option id), then (and only then) reveal the flaw. Callers have already authenticated and parsed
 * the input. `not-gradable` = no key synced, or the RPC failed.
 */
export async function gradeCuckoo({
  userId,
  packSlug,
  cuckooId,
  line,
  contentHash,
}: GradeCuckooInput): Promise<
  ActionResult<{ feedback: CuckooFeedback }, GradeCuckooError>
> {
  const [content, hashes, review] = await Promise.all([
    getPackContent(packSlug),
    getItemHashes(packSlug),
    getReviewContext(userId, packSlug),
  ]);
  const cuckoo = content.cuckoos.find((c) => c.id === cuckooId) ?? null;
  const check = checkCuckooAnswer({
    cuckoo,
    reviewState: cuckoo
      ? reviewStateOf(review, { id: cuckoo.id, origin: cuckoo.origin })
      : "unreviewed",
    fileHash: hashes[cuckooId],
    sentHash: contentHash,
    line,
  });
  if (!check.ok) return check;
  if (!cuckoo) return { ok: false, error: "not-in-pack" };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("record_attempt", {
    p_question_id: cuckoo.id,
    p_chosen: [String(line)],
  });
  if (error || typeof data !== "boolean")
    return { ok: false, error: "not-gradable" };

  return {
    ok: true,
    feedback: {
      correct: data,
      flawLine: cuckoo.flawLine,
      flawKind: cuckoo.flawKind,
      explanation: cuckoo.explanation,
    },
  };
}
