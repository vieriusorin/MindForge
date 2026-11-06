"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { applyFormError } from "@/lib/action-result";
import { createGroup, createPathGroup } from "../../../actions";
import { GroupFormInput, type GroupFormValues } from "../../../schemas";
import type {
  GroupFormFields,
  PathOption,
  UseCreateGroupFormReturn,
} from "../types";
import { pathNoticeFor } from "../utils";

/** MF-0059: one form, two actions: a pack group or a group that follows a path. */
function createFrom(values: GroupFormValues) {
  return values.kind === "path"
    ? createPathGroup({ name: values.name, pathSlug: values.pathSlug })
    : createGroup({ name: values.name, packSlug: values.packSlug });
}

export function useCreateGroupForm(
  defaultPackSlug: string,
  paths: readonly PathOption[] = [],
): UseCreateGroupFormReturn {
  const router = useRouter();
  const defaultValues: GroupFormFields = {
    kind: "pack",
    name: "",
    packSlug: defaultPackSlug,
    pathSlug: paths[0]?.slug ?? "",
  };
  const form = useForm({
    resolver: zodResolver(GroupFormInput),
    defaultValues,
  });
  const kind = useWatch({ control: form.control, name: "kind" });
  const pathSlug = useWatch({ control: form.control, name: "pathSlug" });

  const mutation = useMutation({
    mutationFn: createFrom,
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
    kind,
    canChoosePath: paths.length > 0,
    pathNotice: pathNoticeFor({ kind, pathSlug: pathSlug ?? "", paths }),
  };
}
