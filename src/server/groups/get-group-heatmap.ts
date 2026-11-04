import "server-only";
import { type GroupHeatmap, groupHeatmapFromAttempts } from "@/engine/forest";
import type { Pack } from "@/engine/pack";
import { createSecretSupabase } from "@/server/supabase/secret";
import { fetchGroupAttempts } from "./fetch-group-attempts";

/**
 * MF-0011: the group heatmap — aggregates only, from each member's engine replay. `viewerId` must
 * come from the verified session (getCurrentUser), never from the client; the database refuses a
 * viewer who isn't a member. Group-scoped and a function of `now`, so never cached (GOAL C-1).
 */
export async function getGroupHeatmap(input: {
  groupId: string;
  viewerId: string;
  pack: Pack;
  now: Date;
}): Promise<GroupHeatmap> {
  const attempts = await fetchGroupAttempts(
    createSecretSupabase(),
    input.groupId,
    input.viewerId,
  );
  return groupHeatmapFromAttempts({
    ...attempts,
    pack: input.pack,
    now: input.now,
  });
}
