"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { leavePath } from "@/features/paths/actions";
import type { PathMenuProps, UsePathMenuReturn } from "../types";

const NETWORK_ERROR = "Could not reach the server. Try again.";

/** MF-0058: leave through the Server Action (completions stay), then refresh the RSC page. */
export function usePathMenu({ pathSlug }: PathMenuProps): UsePathMenuReturn {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: () => leavePath({ pathSlug }),
    onSuccess: (result) => {
      if (result.ok) router.refresh();
    },
  });

  let errorMessage: string | null = null;
  if (mutation.isError) errorMessage = NETWORK_ERROR;
  else if (mutation.data && !mutation.data.ok)
    errorMessage = mutation.data.error;

  return {
    leave: () => mutation.mutate(),
    isPending: mutation.isPending,
    errorMessage,
  };
}
