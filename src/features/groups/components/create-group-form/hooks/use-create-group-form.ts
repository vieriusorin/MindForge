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
import { applyFormError } from "@/lib/action-result";
import { createGroup } from "../../../actions";
import { CreateGroupInput, type CreateGroupValues } from "../../../schemas";

export interface UseCreateGroupFormReturn {
  control: Control<CreateGroupValues>;
  register: UseFormRegister<CreateGroupValues>;
  errors: FieldErrors<CreateGroupValues>;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => Promise<void>;
  isSubmitting: boolean;
}

export function useCreateGroupForm(
  defaultPackSlug: string,
): UseCreateGroupFormReturn {
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(CreateGroupInput),
    defaultValues: { name: "", packSlug: defaultPackSlug },
  });

  const mutation = useMutation({
    mutationFn: createGroup,
    onSuccess: (result) => {
      if (!result.ok) {
        applyFormError(form.setError, result.error);
        return;
      }
      router.push(`/groups/${result.groupId}`);
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
    // Stays true through the router.push after success, so the button can't double-submit.
    isSubmitting: mutation.isPending || mutation.data?.ok === true,
  };
}
