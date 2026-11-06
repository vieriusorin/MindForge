"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { formErrorFromZod } from "@/lib/action-result";
import { getCurrentUser } from "@/server/auth/current-user";
import { createServerSupabase } from "@/server/supabase/server";
import { EndExpeditionInput, StartExpeditionInput } from "./schemas";
import type { EndExpeditionResult, StartExpeditionResult } from "./types";
import {
  endExpeditionRpcError,
  startExpeditionRpcError,
} from "./utils/rpc-errors";

/**
 * MF-0017 SC-1, MF-0059: the group admin starts an expedition that runs at the group's own pace
 * (no fixed end date). Called from `useStartExpeditionForm` through `useMutation`; the hook
 * refreshes the page. The database is the authority: it checks the admin, the 4-member minimum,
 * the domain and one-active-per-group (a running one whose target is reached is replaced).
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

/**
 * MF-0059 SC-10: the group admin ends the running expedition. The database checks the admin
 * (42501) and that one is running (P0002); `endExpeditionRpcError` words both.
 */
export async function endExpedition(
  input: unknown,
): Promise<EndExpeditionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/groups");

  const parsed = EndExpeditionInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "This group link is not valid." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("end_expedition", {
    p_group_id: parsed.data.groupId,
  });
  if (error) return { ok: false, error: endExpeditionRpcError(error) };

  refresh();
  return { ok: true };
}
