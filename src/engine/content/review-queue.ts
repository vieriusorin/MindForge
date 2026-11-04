import type { Pack } from "../pack/types";
import { findPackItem, type PackItem } from "./find-item";
import type { PackContent, ReviewCandidate } from "./types";

/**
 * MF-0007 SC-9: the review queue, heavy skills first (the exam weights them most), ties in pack
 * order, then item id. A skill the pack no longer lists goes last.
 */
export function orderReviewQueue(
  candidates: readonly ReviewCandidate[],
  pack: Pack,
): ReviewCandidate[] {
  const rank = new Map(
    pack.domains
      .flatMap((d) => d.skills)
      .map((skill, order) => [skill.code, { weight: skill.weight, order }]),
  );
  const missing = { weight: Number.NEGATIVE_INFINITY, order: rank.size };
  return [...candidates].sort((a, b) => {
    const ra = rank.get(a.skillCode) ?? missing;
    const rb = rank.get(b.skillCode) ?? missing;
    return (
      rb.weight - ra.weight ||
      ra.order - rb.order ||
      a.itemId.localeCompare(b.itemId)
    );
  });
}

/** The item to show next, with the version (content hash) the reviewer will be judging. */
export interface NextReview {
  packItem: PackItem;
  contentHash: string;
}

/**
 * The first queued candidate whose deployed file is the version the registry holds. A sync can run
 * ahead of a deploy (or behind a rollback); showing another version's text would let a verdict
 * land on content nobody read (MF-0007 review). Null when nothing matches.
 */
export function nextReviewItem(
  candidates: readonly ReviewCandidate[],
  pack: Pack,
  content: PackContent,
  fileHashes: Readonly<Record<string, string>>,
): NextReview | null {
  for (const candidate of orderReviewQueue(candidates, pack)) {
    if (fileHashes[candidate.itemId] !== candidate.contentHash) continue;
    const found = findPackItem(content, candidate.itemType, candidate.itemId);
    if (found) return { packItem: found, contentHash: candidate.contentHash };
  }
  return null;
}
