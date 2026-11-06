"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { pinGroup, unpinGroup } from "@/features/groups/actions";
import type { PinToggleProps, UsePinToggleReturn } from "../types";
import { evictionMessage } from "../utils";

const NETWORK_ERROR = "Could not reach the server. Try again.";

/**
 * MF-0054: pin or unpin through the Server Actions, then refresh the RSC screen (sidebar, Today,
 * this toggle's `isPinned`). The DB decides the cap and membership; this only reports what it did.
 */
export function usePinToggle({
  groupId,
  isPinned,
}: Pick<PinToggleProps, "groupId" | "isPinned">): UsePinToggleReturn {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: async (pin: boolean) => {
      if (!pin) {
        const result = await unpinGroup(groupId);
        return result.ok ? { ok: true as const, evicted: null } : result;
      }
      return pinGroup(groupId);
    },
    onSuccess: (result) => {
      if (result.ok) router.refresh();
    },
  });

  let errorMessage: string | null = null;
  let statusMessage: string | null = null;
  if (mutation.isError) errorMessage = NETWORK_ERROR;
  else if (mutation.data && !mutation.data.ok)
    errorMessage = mutation.data.error;
  else if (mutation.data?.ok)
    statusMessage = evictionMessage(mutation.data.evicted);

  return {
    toggle: () => mutation.mutate(!isPinned),
    isPending: mutation.isPending,
    statusMessage,
    errorMessage,
  };
}
