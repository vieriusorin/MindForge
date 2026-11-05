"use server";

import { redirect } from "next/navigation";
import { formErrorFromZod } from "@/lib/action-result";
import { getCurrentUser } from "@/server/auth/current-user";
import { createServerSupabase } from "@/server/supabase/server";
import { StartExpeditionInput } from "./schemas";
import type { StartExpeditionResult } from "./types";
import { startExpeditionRpcError } from "./utils/rpc-errors";

/**
 * MF-0017 SC-1: the group admin starts a 7-day expedition. Called from `useStartExpeditionForm`
 * through `useMutation`; the hook refreshes the page. The database is the authority: it checks the
 * admin, the 4-member minimum, the domain, one-active-per-group, and sets both times.
 */
export async function startExpedition(
  input: unknown,
): Promise<StartExpeditionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/groups");

  const parsed = StartExpeditionInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: formErrorFromZod(parsed.error) };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("start_expedition", {
    p_group_id: parsed.data.groupId,
    p_domain_code: parsed.data.domainCode,
    p_target: parsed.data.target,
  });
  if (error || !data)
    return { ok: false, error: startExpeditionRpcError(error ?? {}) };
  return { ok: true, expeditionId: data };
}
