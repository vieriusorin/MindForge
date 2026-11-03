import type { SupabaseClient } from "@supabase/supabase-js";
import type { Attempt } from "@/engine/memory";
import type { Database } from "@/server/db/database.types";

/** Below the Data API's max_rows (1000), so a full page always means "there may be more". */
const PAGE_SIZE = 500;

/**
 * ALL of a learner's graded attempts for a pack, oldest first, through the given (RLS-bound)
 * client. Paged: a single request is capped by the API's max_rows and would silently drop the
 * newest answers (MF-0003 review). Ordered by (answered_at, id) so pages never skip or repeat.
 */
export async function fetchAttempts(
  client: SupabaseClient<Database>,
  userId: string,
  packSlug: string,
): Promise<Attempt[]> {
  const out: Attempt[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from("attempts")
      .select("question_id, skill_code, correct, answered_at")
      .eq("user_id", userId)
      .eq("pack_slug", packSlug)
      .order("answered_at")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`fetchAttempts: ${error.message}`);
    for (const r of data) {
      out.push({
        questionId: r.question_id,
        skillCode: r.skill_code,
        correct: r.correct,
        answeredAt: new Date(r.answered_at),
      });
    }
    if (data.length < PAGE_SIZE) return out;
  }
}
