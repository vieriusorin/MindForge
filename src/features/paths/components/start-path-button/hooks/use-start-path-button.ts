"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { startPath } from "@/features/paths/actions";
import type { StartPathButtonProps, UseStartPathButtonReturn } from "../types";

const NETWORK_ERROR = "Could not reach the server. Try again.";

/** MF-0058: enroll through the Server Action, then refresh the RSC page (it re-reads progress). */
export function useStartPathButton({
  pathSlug,
}: StartPathButtonProps): UseStartPathButtonReturn {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: () => startPath({ pathSlug }),
    onSuccess: (result) => {
      if (result.ok) router.refresh();
    },
  });

  let errorMessage: string | null = null;
  if (mutation.isError) errorMessage = NETWORK_ERROR;
  else if (mutation.data && !mutation.data.ok)
    errorMessage = mutation.data.error;

  return {
    start: () => mutation.mutate(),
    isPending: mutation.isPending,
    errorMessage,
  };
}
