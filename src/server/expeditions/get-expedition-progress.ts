import "server-only";
import { z } from "zod";
import { createServerSupabase } from "@/server/supabase/server";

const Progress = z.number().int().nonnegative();

/**
 * MF-0017: the group total of countable correct recalls for one expedition (one integer, never
 * per member). Throws on a non-member (42501), a group under 4 members (P0001) or a DB error.
 */
export async function getExpeditionProgress(
  expeditionId: string,
): Promise<number> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("expedition_progress", {
    p_expedition_id: expeditionId,
  });
  if (error) throw new Error(`getExpeditionProgress: ${error.message}`);
  return Progress.parse(data);
}
