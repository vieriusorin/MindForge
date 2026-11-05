import type { Cuckoo, PlayableCuckoo } from "./types";

/**
 * MF-0016 SC-3: the pre-answer view of a cuckoo, bound to the version the learner reads. Fields are
 * picked one by one, never spread, so a new key field can't leak by default.
 */
export function toPlayableCuckoo(
  cuckoo: Cuckoo,
  contentHash: string,
): PlayableCuckoo {
  return {
    id: cuckoo.id,
    skillCode: cuckoo.skill,
    origin: cuckoo.origin,
    title: cuckoo.title,
    snippetKind: cuckoo.snippetKind,
    lines: [...cuckoo.lines],
    contentHash,
  };
}
