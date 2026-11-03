"use client";

import { useActionState } from "react";
import { createGroup } from "../../../actions";
import type { CreateGroupState } from "../../../types";

export interface UseCreateGroupFormReturn {
  state: CreateGroupState;
  formAction: (formData: FormData) => void;
  isPending: boolean;
}

export function useCreateGroupForm(): UseCreateGroupFormReturn {
  const [state, formAction, isPending] = useActionState(createGroup, {
    status: "idle",
  });
  return { state, formAction, isPending };
}
