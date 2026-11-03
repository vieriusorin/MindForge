/** The pack shown when a learner has no group yet. */
export const DEFAULT_PACK_SLUG = "ccdv-f";

/** A learner's dashboard follows their most recently joined group's pack (groups arrive newest first). */
export function primaryPackSlug(
  groups: readonly { packSlug: string }[],
): string {
  return groups[0]?.packSlug ?? DEFAULT_PACK_SLUG;
}
