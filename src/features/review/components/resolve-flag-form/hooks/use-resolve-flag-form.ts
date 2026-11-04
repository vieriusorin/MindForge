"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  type FieldErrors,
  type UseFormRegister,
  useForm,
} from "react-hook-form";
import { applyFormError } from "@/lib/action-result";
import { resolveFlags } from "../../../actions";
import {
  type ResolveAction,
  ResolveFlagsInput,
  type ResolveFlagsValues,
} from "../../../schemas";
import type { ResolveFlagFormProps } from "../types";

export interface UseResolveFlagFormReturn {
  register: UseFormRegister<ResolveFlagsValues>;
  errors: FieldErrors<ResolveFlagsValues>;
  onDismiss: () => Promise<void>;
  onReject: () => Promise<void>;
  /** The decision on its way, or null. Both buttons stay disabled until the page re-renders. */
  pendingAction: ResolveAction | null;
}

const DEFAULT_ACTION: ResolveAction = "dismiss";

/** MF-0007 SC-4: a maintainer dismisses the open flags or rejects the item, with a comment. */
export function useResolveFlagForm({
  itemId,
  contentHash,
}: ResolveFlagFormProps): UseResolveFlagFormReturn {
  const form = useForm({
    resolver: zodResolver(ResolveFlagsInput),
    defaultValues: {
      itemId,
      contentHash,
      action: DEFAULT_ACTION,
      comment: "",
    },
  });

  const mutation = useMutation({
    // typed input so `variables.action` says which button is pending
    mutationFn: (values: ResolveFlagsValues) => resolveFlags(values),
    onSuccess: (result) => {
      if (!result.ok) applyFormError(form.setError, result.error);
    },
    onError: () =>
      form.setError("root.server", {
        type: "server",
        message: "Could not reach the server. Try again.",
      }),
  });

  const submitAs = (action: ResolveAction) => () => {
    form.setValue("action", action);
    return form.handleSubmit((values) => mutation.mutate(values))();
  };

  const isBusy = mutation.isPending || mutation.data?.ok === true;
  return {
    register: form.register,
    errors: form.formState.errors,
    onDismiss: submitAs("dismiss"),
    onReject: submitAs("reject"),
    pendingAction: isBusy ? (mutation.variables?.action ?? null) : null,
  };
}
