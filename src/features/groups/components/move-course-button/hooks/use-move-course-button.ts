"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { advanceGroupCourse } from "@/features/groups/actions";
import type {
  MoveCourseButtonProps,
  UseMoveCourseButtonReturn,
} from "../types";
import { moveDialogCopy } from "../utils";

const NETWORK_ERROR = "Could not reach the server. Try again.";

/** MF-0059: the admin moves the group one course forward; the page is an RSC read, so refresh. */
export function useMoveCourseButton({
  groupId,
  fromPack,
  nextCourseName,
  disabledReason,
  hasRunningExpedition,
}: MoveCourseButtonProps): UseMoveCourseButtonReturn {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: () => advanceGroupCourse({ groupId, fromPack }),
    onSuccess: (result) => {
      if (result.ok) router.refresh();
    },
  });

  let errorMessage: string | null = null;
  if (mutation.isError) errorMessage = NETWORK_ERROR;
  else if (mutation.data && !mutation.data.ok)
    errorMessage = mutation.data.error;

  // The page keys this button by the current course, so a fresh one mounts after the refresh.
  const isPending = mutation.isPending || mutation.data?.ok === true;
  return {
    move: () => mutation.mutate(),
    isPending,
    isDisabled: isPending || disabledReason !== null,
    errorMessage,
    dialog: moveDialogCopy({ nextCourseName, hasRunningExpedition }),
  };
}
