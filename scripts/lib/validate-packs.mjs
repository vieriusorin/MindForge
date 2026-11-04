// MF-0012: the sync script validates with the app's own loaders, so it never syncs a file the
// app would refuse to load (MF-0003 review).
import { register } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

register("./ts-resolve.mjs", import.meta.url);

/**
 * Load every pack under `packsDir` (pack.yaml, questions, cards, diagrams) exactly as the app does.
 * Returns one line per problem, across all packs; empty means every pack is valid.
 */
export async function validatePacks(root, packsDir, packs) {
  const engine = (path) => import(pathToFileURL(join(root, path)).href);
  const { loadPackFile } = await engine("src/engine/pack/index.ts");
  const { loadPackContent } = await engine("src/engine/content/index.ts");
  const problems = [];
  for (const slug of packs) {
    const dir = join(packsDir, slug);
    try {
      const pack = await loadPackFile(join(dir, "pack.yaml"));
      await loadPackContent(pack, dir);
    } catch (error) {
      problems.push(`${slug}: ${error.message}`);
    }
  }
  return problems;
}
