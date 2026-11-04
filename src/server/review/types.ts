import { z } from "zod";
import { ITEM_TYPES, REVIEW_STATES } from "@/engine/content";

/**
 * MF-0007: the review RPCs return text columns; their closed sets are enforced by the database
 * and narrowed here, at the boundary, with zod.
 */
export const ReviewStateRows = z.array(
  z.object({
    item_id: z.string(),
    state: z.enum(REVIEW_STATES),
    reviewed_at: z.string().nullable(),
  }),
);

export const ReviewableRows = z.array(
  z.object({
    item_id: z.string(),
    skill_code: z.string(),
    item_type: z.enum(ITEM_TYPES),
    content_hash: z.string(),
  }),
);

export const OpenFlagRows = z.array(
  z.object({
    item_id: z.string(),
    flag_id: z.number(),
    comment: z.string(),
    reviewer_name: z.string().nullable(),
    created_at: z.string(),
  }),
);

export const PendingAnalogyRows = z.array(
  z.object({
    item_id: z.string(),
    approvals: z.number(),
    hash_synced_at: z.string(),
    can_approve: z.boolean(),
  }),
);

/** One open flag on an item's current version. Only maintainers ever receive these. */
export interface OpenFlag {
  itemId: string;
  flagId: number;
  comment: string;
  /** The flagger's display name; null when their profile is gone. */
  reviewerName: string | null;
  createdAt: string;
}

/** A nature card whose current version still lacks the analogy owner's approval. */
export interface PendingAnalogy {
  itemId: string;
  approvals: number;
  hashSyncedAt: string;
  /** The caller is the analogy owner, or a maintainer and 48 h have passed (C-3). */
  canApprove: boolean;
}

/** Postgres refused for lack of permission (not a maintainer / not a member). */
export const INSUFFICIENT_PRIVILEGE = "42501";
