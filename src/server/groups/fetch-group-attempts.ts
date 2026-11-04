import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyReviewContext } from "@/engine/content";
import type { GroupAttempts, GroupMemberAttempts } from "@/engine/forest";
import type { Database } from "@/server/db/database.types";
import { GroupAttemptRows } from "./types";

type GroupAttemptRow = ReturnType<typeof GroupAttemptRows.parse>[number];

/** One member's row → their attempts plus their OWN review context (rejected, spoiled). */
function toMemberAttempts(row: GroupAttemptRow): GroupMemberAttempts {
  const review = emptyReviewContext();
  for (const a of row.attempts) {
    if (a.rejected) review.rejected.add(a.question_id);
    if (a.spoiled_at !== null) {
      review.spoiledBy.add(a.question_id);
      review.spoiledAt.set(a.question_id, new Date(a.spoiled_at));
    }
  }
  return {
    attempts: row.attempts.map((a) => ({
      questionId: a.question_id,
      skillCode: a.skill_code,
      correct: a.correct,
      answeredAt: new Date(a.answered_at),
    })),
    review,
  };
}

/**
 * MF-0011: every member's attempts on the group's pack, each with that member's OWN review
 * context, split into the viewer and the others, through the privileged client
 * (`public.group_attempts` is executable by the server role only). Throws when `viewerId` is not
 * a member (42501) or on any database error. Takes the client as a parameter so the DB tests can
 * drive it; in the app only `get-group-heatmap.ts` calls it, and only its aggregate leaves the server.
 */
export async function fetchGroupAttempts(
  client: SupabaseClient<Database>,
  groupId: string,
  viewerId: string,
): Promise<GroupAttempts> {
  const { data, error } = await client.rpc("group_attempts", {
    p_group_id: groupId,
    p_viewer_id: viewerId,
  });
  if (error) throw new Error(`fetchGroupAttempts: ${error.message}`);
  const rows = GroupAttemptRows.parse(data);
  const viewer = rows.find((r) => r.is_viewer);
  return {
    viewer: viewer ? toMemberAttempts(viewer) : null,
    others: rows.filter((r) => !r.is_viewer).map(toMemberAttempts),
  };
}
