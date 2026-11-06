"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { endExpedition } from "@/features/expeditions/actions";
import type {
  EndExpeditionButtonProps,
  UseEndExpeditionButtonReturn,
} from "../types";

const NETWORK_ERROR = "Could not reach the server. Try again.";

/** MF-0059 (own pace): the admin ends the running expedition; the card is an RSC read, so refresh. */
export function useEndExpeditionButton({
  groupId,
}: EndExpeditionButtonProps): UseEndExpeditionButtonReturn {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: () => endExpedition({ groupId }),
    onSuccess: (result) => {
      if (result.ok) router.refresh();
    },
  });

  let errorMessage: string | null = null;
  if (mutation.isError) errorMessage = NETWORK_ERROR;
  else if (mutation.data && !mutation.data.ok)
    errorMessage = mutation.data.error;

  return {
    end: () => mutation.mutate(),
    isPending: mutation.isPending || mutation.data?.ok === true,
    errorMessage,
  };
}
