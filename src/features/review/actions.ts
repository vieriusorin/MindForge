"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { formErrorFromZod } from "@/lib/action-result";
import { getCurrentUser } from "@/server/auth/current-user";
import { createServerSupabase } from "@/server/supabase/server";
import {
  ApproveAnalogyInput,
  ApproveItemInput,
  FlagItemInput,
  ResolveFlagsInput,
} from "./schemas";
import type {
  FlagItemResult,
  ResolveFlagsResult,
  ReviewActionResult,
} from "./types";
import { reviewRpcError } from "./utils/rpc-errors";

/*
 * MF-0007. Every rule (member, author, maintainer, 48 h) is enforced by the database's definer
 * functions; these actions authenticate, re-parse, call them and say what happened. Every call
 * names the version the actor read (`contentHash`); a stale one comes back as 55000. Review rows
 * are per-user and uncached, so success re-renders with refresh(); there is no tag to expire.
 */

export async function approveItem(input: unknown): Promise<ReviewActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const parsed = ApproveItemInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "This item is not valid." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("review_item", {
    p_item_id: parsed.data.itemId,
    p_verdict: "approve",
    p_comment: "",
    p_content_hash: parsed.data.contentHash,
  });
  if (error) return { ok: false, error: reviewRpcError(error) };
  refresh();
  return { ok: true };
}

export async function flagItem(input: unknown): Promise<FlagItemResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const parsed = FlagItemInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: formErrorFromZod(parsed.error) };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("review_item", {
    p_item_id: parsed.data.itemId,
    p_verdict: "flag",
    p_comment: parsed.data.comment,
    p_content_hash: parsed.data.contentHash,
  });
  if (error) return { ok: false, error: { message: reviewRpcError(error) } };
  refresh();
  return { ok: true };
}

export async function resolveFlags(
  input: unknown,
): Promise<ResolveFlagsResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const parsed = ResolveFlagsInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: formErrorFromZod(parsed.error) };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("resolve_flags", {
    p_item_id: parsed.data.itemId,
    p_action: parsed.data.action,
    p_comment: parsed.data.comment,
    p_content_hash: parsed.data.contentHash,
  });
  if (error) return { ok: false, error: { message: reviewRpcError(error) } };
  refresh();
  return { ok: true };
}

export async function approveAnalogy(
  input: unknown,
): Promise<ReviewActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const parsed = ApproveAnalogyInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "This card is not valid." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("approve_analogy", {
    p_item_id: parsed.data.itemId,
    p_content_hash: parsed.data.contentHash,
  });
  if (error) return { ok: false, error: reviewRpcError(error) };
  refresh();
  return { ok: true };
}
