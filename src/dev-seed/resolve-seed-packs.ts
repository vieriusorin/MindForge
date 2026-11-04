/** A pack folder the seed could fill, with how many questions its files hold. */
export interface SeedPackCandidate {
  slug: string;
  questionCount: number;
}

/**
 * MF-0034: which packs a `pnpm dev:seed` run fills. No request: every pack with questions. A request:
 * exactly those packs; an unknown slug or a pack without questions is refused before anything is written.
 */
export function resolveSeedPacks({
  available,
  requested,
}: {
  available: readonly SeedPackCandidate[];
  requested: readonly string[];
}): string[] {
  const withQuestions = new Set(
    available.filter((p) => p.questionCount > 0).map((p) => p.slug),
  );
  if (requested.length === 0) return [...withQuestions].sort();
  const known = new Set(available.map((p) => p.slug));
  for (const slug of requested) {
    if (!known.has(slug))
      throw new Error(`dev:seed: no pack "${slug}" under packs/`);
    if (!withQuestions.has(slug))
      throw new Error(`dev:seed: pack "${slug}" has no questions to answer`);
  }
  return [...new Set(requested)].sort();
}
