"use client";

import { useMutation } from "@tanstack/react-query";
import type { RotateInviteResult } from "../../../types";

export interface UseInviteLinkReturn {
  reset: () => void;
  isResetting: boolean;
  /** Why the last reset failed, or null. */
  errorMessage: string | null;
}

const NETWORK_ERROR = "Could not reach the server. Try again.";

/**
 * MF-0004: reset the invite link through the bound Server Action and keep its failure visible.
 * On success the action calls refresh(), so the page re-renders with the new link.
 */
export function useInviteLink(
  rotateAction: () => Promise<RotateInviteResult>,
): UseInviteLinkReturn {
  const mutation = useMutation({ mutationFn: () => rotateAction() });

  let errorMessage: string | null = null;
  if (mutation.isError) errorMessage = NETWORK_ERROR;
  else if (mutation.data && !mutation.data.ok)
    errorMessage = mutation.data.error;

  return {
    reset: () => mutation.mutate(),
    isResetting: mutation.isPending,
    errorMessage,
  };
}
