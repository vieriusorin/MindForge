import YAML from "yaml";
import { z } from "zod";
import { contentHash } from "./hash";
import type { ContentFiles } from "./types";

/** Only the shape the hash needs; every other key is kept as written, because it is content. */
const RawItems = (kind: keyof ContentFiles) =>
  z.object({ [kind]: z.array(z.looseObject({ id: z.string() })) });

/**
 * MF-0007 review finding: each item's content hash, computed from the RAW YAML item exactly as
 * scripts/sync-question-keys.mjs computes it for the registry. A verdict carries the hash of the
 * file the reader saw, so the database can refuse it when the registry holds another version.
 * Files that fail to parse are skipped here; `parseContent` is the validator.
 */
export function itemHashes(files: ContentFiles): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const kind of ["questions", "cards", "diagrams"] as const) {
    for (const file of files[kind]) {
      const parsed = RawItems(kind).safeParse(YAML.parse(file.text));
      if (!parsed.success) continue;
      for (const item of parsed.data[kind] ?? [])
        hashes[item.id] = contentHash(item);
    }
  }
  return hashes;
}
