import "server-only";
import { z } from "zod";
import { createServerSupabase } from "@/server/supabase/server";
import type { GroupPin } from "./types";

const PinRows = z.array(
  z.object({ group_id: z.uuid(), pinned_at: z.iso.datetime({ offset: true }) }),
);

/** MF-0054: the signed-in learner's own pins (public.list_my_pins scopes to auth.uid()), newest first. */
export async function listMyPins(): Promise<GroupPin[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("list_my_pins");
  if (error) throw new Error(`listMyPins: ${error.message}`);
  return PinRows.parse(data).map((r) => ({
    groupId: r.group_id,
    pinnedAt: r.pinned_at,
  }));
}
