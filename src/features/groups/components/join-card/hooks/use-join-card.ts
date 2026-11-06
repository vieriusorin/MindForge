"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { joinGroup } from "@/features/groups/actions";
import type { UseJoinCardReturn } from "../types";

const NETWORK_ERROR = "Could not reach the server. Try again.";

/** MF-0059 (F6): join through the Server Action, then open the group. No join on render. */
export function useJoinCard(code: string): UseJoinCardReturn {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: () => joinGroup({ code }),
    onSuccess: (result) => {
      if (result.ok) router.push(`/groups/${result.groupId}`);
    },
  });

  let errorMessage: string | null = null;
  if (mutation.isError) errorMessage = NETWORK_ERROR;
  else if (mutation.data && !mutation.data.ok)
    errorMessage = mutation.data.error;

  return {
    join: () => mutation.mutate(),
    isPending: mutation.isPending || mutation.data?.ok === true,
    errorMessage,
  };
}
