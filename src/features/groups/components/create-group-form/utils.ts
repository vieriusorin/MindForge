import { createNotice } from "../../utils/path-notice";
import type { GroupKind, PathOption } from "./types";

/** MF-0059: the enroll notice for the chosen path; null for a pack group or no listed path. */
export function pathNoticeFor(input: {
  kind: GroupKind;
  pathSlug: string;
  paths: readonly PathOption[];
}): string | null {
  if (input.kind !== "path") return null;
  const path = input.paths.find((p) => p.slug === input.pathSlug);
  return path ? createNotice(path.name) : null;
}
