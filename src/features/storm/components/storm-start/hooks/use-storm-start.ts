"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { startStorm } from "../../../actions";
import type { StormStartProps, UseStormStartReturn } from "../types";

export function useStormStart({
  packSlug,
  kind,
  domainCode,
}: Pick<
  StormStartProps,
  "packSlug" | "kind" | "domainCode"
>): UseStormStartReturn {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: startStorm,
    onSuccess: (result) => {
      if (result.ok) router.push(`/storms/${result.stormId}`);
    },
  });

  const result = mutation.data;
  let error: string | null = null;
  if (result && !result.ok) error = result.error;
  else if (mutation.isError) error = "Could not reach the server. Try again.";
  // Stays true through the router.push after success, so Start can't fire twice.
  const isStarting = mutation.isPending || result?.ok === true;

  return {
    start: () => {
      if (isStarting) return;
      mutation.mutate({ packSlug, kind, domainCode });
    },
    isStarting,
    error,
  };
}
