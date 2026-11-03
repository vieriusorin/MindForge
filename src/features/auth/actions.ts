"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/server/auth/safe-next";
import { siteOrigin } from "@/server/http/site-origin";
import { createServerSupabase } from "@/server/supabase/server";
import type { SendLinkState } from "./types";

const SendLinkInput = z.strictObject({
  email: z.email().max(254),
  next: z.string().max(512).optional(),
});

export async function sendMagicLink(
  _prev: SendLinkState,
  formData: FormData,
): Promise<SendLinkState> {
  const parsed = SendLinkInput.safeParse({
    email: formData.get("email"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success)
    return { status: "error", message: "Enter a valid email address." };

  const next = safeNextPath(parsed.data.next) ?? "/today";
  const callback = new URL("/auth/callback", siteOrigin());
  callback.searchParams.set("next", next);

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: callback.toString(), shouldCreateUser: true },
  });
  if (error)
    return {
      status: "error",
      message: "Could not send the sign-in link. Try again in a minute.",
    };
  return { status: "sent", email: parsed.data.email };
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/");
}
