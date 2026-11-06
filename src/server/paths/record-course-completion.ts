import "server-only";
import { isCourseComplete } from "@/engine/path";
import { getPack } from "@/server/packs/get-pack";
import { createSecretSupabase } from "@/server/supabase/secret";
import { createServerSupabase } from "@/server/supabase/server";
import { getMyCourseForest } from "./get-my-course-forest";

/**
 * ADR 0006 (docs/adr/0006-server-only-secret-key-for-course-completions.md, after ADR 0004):
 * learners have no write grant on `course_completions`, because "Course complete" needs the TS
 * memory replay a learner-callable RPC can't run and a learner could forge. So this file is the
 * secret client's one write: a single insert, values computed here, the client never leaves it.
 */

export interface RecordCourseCompletionInput {
  userId: string;
  packSlug: string;
  now: Date;
}

const UNIQUE_VIOLATION = "23505";

/**
 * MF-0058: after a graded attempt, write the learner's `course_completions` row once every skill of
 * the course pack is at Sapling or above. Written once, never changed: a recorded row makes this a
 * no-op, and exam/onboarding packs never complete. Every read runs as the learner (RLS), so `userId`
 * must be the session user; a mismatched id reads no attempts and writes nothing. Throws on an
 * infrastructure error; callers catch it (a completion never fails the answer, SC-6).
 */
export async function recordCourseCompletion({
  userId,
  packSlug,
  now,
}: RecordCourseCompletionInput): Promise<void> {
  const pack = await getPack(packSlug);
  if (pack.kind !== "course") return;

  const supabase = await createServerSupabase();
  const existing = await supabase
    .from("course_completions")
    .select("pack_slug")
    .eq("user_id", userId)
    .eq("pack_slug", pack.slug)
    .maybeSingle();
  if (existing.error)
    throw new Error(`recordCourseCompletion: ${existing.error.message}`);
  if (existing.data) return;

  const forest = await getMyCourseForest({ userId, packSlug: pack.slug, now });
  if (!isCourseComplete(forest)) return;

  // completed_at is the DB default now(): the database owns the clock.
  const { error } = await createSecretSupabase()
    .from("course_completions")
    .insert({
      user_id: userId,
      pack_slug: pack.slug,
      pack_version: pack.version,
    });
  // a concurrent qualifying answer wrote the row first: still recorded once
  if (error && error.code !== UNIQUE_VIOLATION)
    throw new Error(`recordCourseCompletion: ${error.message}`);
}
