"use client";

import { useMutation } from "@tanstack/react-query";
import { approveAnalogy } from "../../../actions";
import type { ApproveAnalogyButtonProps } from "../types";

export interface UseApproveAnalogyReturn {
  onApprove: () => void;
  isApproving: boolean;
  /** Why the approval failed, or null. */
  error: string | null;
}

/** MF-0007 SC-6: approve a nature card's analogy; the action's refresh() drops it from the list. */
export function useApproveAnalogy({
  itemId,
  contentHash,
}: Pick<
  ApproveAnalogyButtonProps,
  "itemId" | "contentHash"
>): UseApproveAnalogyReturn {
  const mutation = useMutation({ mutationFn: approveAnalogy });
  const result = mutation.data;
  let error: string | null = null;
  if (result && !result.ok) error = result.error;
  if (mutation.isError) error = "Could not reach the server. Try again.";
  return {
    onApprove: () => mutation.mutate({ itemId, contentHash }),
    isApproving: mutation.isPending || result?.ok === true,
    error,
  };
}
