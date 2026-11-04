import { z } from "zod";

/**
 * MF-0007: shared by the forms (zodResolver, UX) and the Server Actions (re-parse, the real
 * boundary). The database checks the same limits again (private.review_item / resolve_flags).
 */
const ItemId = z.string().min(1).max(200);

/** The version the actor read: the hash of the deployed file. The database refuses another one. */
const ContentHash = z.string().min(1).max(128);

const Comment = (empty: string) =>
  z.string().trim().min(1, empty).max(2000, "Keep it under 2000 characters.");

export const ApproveItemInput = z.strictObject({
  itemId: ItemId,
  contentHash: ContentHash,
});

export const FlagItemInput = z.strictObject({
  itemId: ItemId,
  contentHash: ContentHash,
  comment: Comment("Say what is wrong, so a maintainer can fix it."),
});
export type FlagItemValues = z.input<typeof FlagItemInput>;

export const RESOLVE_ACTIONS = ["dismiss", "reject"] as const;
export type ResolveAction = (typeof RESOLVE_ACTIONS)[number];

export const ResolveFlagsInput = z.strictObject({
  itemId: ItemId,
  contentHash: ContentHash,
  action: z.enum(RESOLVE_ACTIONS),
  comment: Comment("Explain your decision to the reviewers."),
});
export type ResolveFlagsValues = z.input<typeof ResolveFlagsInput>;

export const ApproveAnalogyInput = z.strictObject({
  itemId: ItemId,
  contentHash: ContentHash,
});
