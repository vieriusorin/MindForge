/**
 * MF-0024: an item id belongs to the pack whose slug it starts with. A slug has no dot, so two
 * packs can never claim one id, and the global key in private.question_keys / private.items holds.
 * Returns the issue text, or null when the id is the pack's.
 */
export function idPrefixIssue(id: string, slug: string): string | null {
  return id.startsWith(`${slug}.`)
    ? null
    : `id "${id}" must start with "${slug}."`;
}
