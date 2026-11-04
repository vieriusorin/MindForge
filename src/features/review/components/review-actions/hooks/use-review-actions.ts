"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import {
  type FieldErrors,
  type UseFormRegister,
  useForm,
} from "react-hook-form";
import { applyFormError } from "@/lib/action-result";
import { approveItem, flagItem } from "../../../actions";
import { FlagItemInput, type FlagItemValues } from "../../../schemas";
import type { ReviewActionsProps } from "../types";

export interface UseReviewActionsReturn {
  register: UseFormRegister<FlagItemValues>;
  errors: FieldErrors<FlagItemValues>;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => Promise<void>;
  onApprove: () => void;
  isApproving: boolean;
  isFlagging: boolean;
  /** Either verdict is on its way; both buttons stay disabled until the next item renders. */
  isSubmitting: boolean;
}

const UNREACHABLE = "Could not reach the server. Try again.";

/**
 * MF-0007 SC-9: approve, or flag with a comment. On success the action's refresh() re-renders
 * the page with the next item, which remounts this component (keyed by item id).
 */
export function useReviewActions({
  itemId,
  contentHash,
}: ReviewActionsProps): UseReviewActionsReturn {
  const form = useForm({
    resolver: zodResolver(FlagItemInput),
    defaultValues: { itemId, contentHash, comment: "" },
  });
  const serverError = (message: string) =>
    form.setError("root.server", { type: "server", message });

  const approve = useMutation({
    mutationFn: approveItem,
    onSuccess: (result) => {
      if (!result.ok) serverError(result.error);
    },
    onError: () => serverError(UNREACHABLE),
  });

  const flag = useMutation({
    mutationFn: flagItem,
    onSuccess: (result) => {
      if (!result.ok) applyFormError(form.setError, result.error);
    },
    onError: () => serverError(UNREACHABLE),
  });

  const isApproving = approve.isPending || approve.data?.ok === true;
  const isFlagging = flag.isPending || flag.data?.ok === true;
  return {
    register: form.register,
    errors: form.formState.errors,
    onSubmit: form.handleSubmit((values) => flag.mutate(values)),
    onApprove: () => {
      form.clearErrors("root.server");
      approve.mutate({ itemId, contentHash });
    },
    isApproving,
    isFlagging,
    isSubmitting: isApproving || isFlagging,
  };
}
