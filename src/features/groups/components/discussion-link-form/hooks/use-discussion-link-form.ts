"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { applyFormError } from "@/lib/action-result";
import { setGroupDiscussionLink } from "../../../actions";
import {
  DiscussionLinkFormInput,
  type DiscussionLinkFormValues,
} from "../../../schemas";
import type {
  DiscussionLinkFormProps,
  UseDiscussionLinkFormReturn,
} from "../types";

/**
 * MF-0063: the admin sets or clears the group's discussion link. The page is an RSC read, so a
 * success refreshes it; the page keys this form by the link, so a fresh one mounts after.
 */
export function useDiscussionLinkForm({
  groupId,
  currentUrl,
}: DiscussionLinkFormProps): UseDiscussionLinkFormReturn {
  const router = useRouter();
  const defaultValues: DiscussionLinkFormValues = { url: currentUrl ?? "" };
  const form = useForm({
    resolver: zodResolver(DiscussionLinkFormInput),
    defaultValues,
  });

  const mutation = useMutation({
    // The raw input, not the resolver output: the action re-parses it (null is the action's "").
    mutationFn: (url: string) => setGroupDiscussionLink({ groupId, url }),
    onSuccess: (result) => {
      if (!result.ok) {
        applyFormError(form.setError, result.error);
        return;
      }
      router.refresh();
    },
    onError: () => {
      form.setError("root.server", {
        type: "server",
        message: "Could not reach the server. Try again.",
      });
    },
  });

  return {
    register: form.register,
    errors: form.formState.errors,
    onSubmit: form.handleSubmit((values) => mutation.mutate(values.url ?? "")),
    onRemove: () => mutation.mutate(""),
    isSubmitting: mutation.isPending,
    hasLink: currentUrl !== null,
  };
}
