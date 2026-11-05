"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import {
  type Control,
  type FieldErrors,
  type UseFormRegister,
  useForm,
} from "react-hook-form";
import { EXPEDITION_TARGET } from "@/engine/expedition";
import { applyFormError } from "@/lib/action-result";
import { startExpedition } from "../../../actions";
import {
  StartExpeditionInput,
  type StartExpeditionValues,
} from "../../../schemas";

export interface UseStartExpeditionFormReturn {
  control: Control<StartExpeditionValues>;
  register: UseFormRegister<StartExpeditionValues>;
  errors: FieldErrors<StartExpeditionValues>;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => Promise<void>;
  isSubmitting: boolean;
}

export function useStartExpeditionForm(input: {
  groupId: string;
  defaultDomainCode: string;
}): UseStartExpeditionFormReturn {
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(StartExpeditionInput),
    defaultValues: {
      groupId: input.groupId,
      domainCode: input.defaultDomainCode,
      target: EXPEDITION_TARGET.default,
    },
  });

  const mutation = useMutation({
    mutationFn: startExpedition,
    onSuccess: (result) => {
      if (!result.ok) {
        applyFormError(form.setError, result.error);
        return;
      }
      // The card is an RSC read: refresh swaps the form for the running expedition.
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
    control: form.control,
    register: form.register,
    errors: form.formState.errors,
    onSubmit: form.handleSubmit((values) => mutation.mutate(values)),
    // Stays true through the refresh after success, so the button can't double-submit.
    isSubmitting: mutation.isPending || mutation.data?.ok === true,
  };
}
