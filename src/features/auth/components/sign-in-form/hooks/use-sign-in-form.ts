"use client";

import { useActionState } from "react";
import { sendMagicLink } from "../../../actions";
import type { SendLinkState } from "../../../types";

export interface UseSignInFormReturn {
  state: SendLinkState;
  formAction: (formData: FormData) => void;
  isPending: boolean;
}

export function useSignInForm(): UseSignInFormReturn {
  const [state, formAction, isPending] = useActionState(sendMagicLink, {
    status: "idle",
  });
  return { state, formAction, isPending };
}
