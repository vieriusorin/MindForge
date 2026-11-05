/**
 * MF-0029 / MF-0052: the file `pnpm dev:seed` leaves in `.cache/dev-seed/manifest.json`, so the next run
 * replaces your seeded rows and only those. Parsed with zod at the boundary; a manifest written before
 * MF-0052 has no `youStormIds` and stays valid.
 */
import { z } from "zod";
import type { SeedManifest } from "./types";

export const ManifestFile = z.strictObject({
  youEmail: z.string(),
  youId: z.string(),
  youAttemptIds: z.array(z.number().int()),
  youStormIds: z.array(z.uuid()).optional(),
});

/** The manifest for `youEmail`, or null when it was written for another email. Throws a ZodError on a bad shape. */
export function toSeedManifest(
  raw: unknown,
  youEmail: string,
): SeedManifest | null {
  const parsed = ManifestFile.parse(raw);
  if (parsed.youEmail.trim().toLowerCase() !== youEmail.trim().toLowerCase())
    return null;
  return {
    youId: parsed.youId,
    youAttemptIds: parsed.youAttemptIds,
    ...(parsed.youStormIds ? { youStormIds: parsed.youStormIds } : {}),
  };
}
