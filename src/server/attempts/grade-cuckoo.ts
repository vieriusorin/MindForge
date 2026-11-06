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
import { recordCourseCompletion } from "@/server/paths/record-course-completion";
import { createServerSupabase } from "@/server/supabase/server";
import { isStaleVersionError } from "./is-stale-version-error";

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
 * the input. `not-gradable` = no key synced, or the RPC failed. MF-0032: the hash goes to the DB too.
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
    p_content_hash: contentHash,
  });
  // MF-0032: the registry holds another version (sync ran ahead of this deploy).
  if (isStaleVersionError(error)) return { ok: false, error: "changed" };
  if (error || typeof data !== "boolean")
    return { ok: false, error: "not-gradable" };

  // MF-0058 SC-6: only a correct answer can raise stability, so only it can complete a course.
  if (data) {
    try {
      await recordCourseCompletion({ userId, packSlug, now: new Date() });
    } catch (error) {
      // MF-0058 SC-6: completion is a side effect of a committed attempt; it never fails the answer.
      console.error(
        "recordCourseCompletion:",
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }

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
