import "server-only";
import { z } from "zod";
import { createServerSupabase } from "@/server/supabase/server";

const PackSlug = z.string().min(1);

/**
 * MF-0059: the pack an expedition was started on (the group may have moved to its next course
 * since). Throws on a non-member (the page gates membership first) or a database error. Never cached.
 */
export async function getExpeditionPack(expeditionId: string): Promise<string> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("expedition_pack", {
    p_expedition_id: expeditionId,
  });
  if (error) throw new Error(`getExpeditionPack: ${error.message}`);
  return PackSlug.parse(data);
}
