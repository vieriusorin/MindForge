// MF-0012: the sync script validates with the app's own loaders, so it never syncs a file the
// app would refuse to load (MF-0003 review).
import { register } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

register("./ts-resolve.mjs", import.meta.url);

/**
 * Load every pack under `packsDir` (pack.yaml, questions, cards, diagrams, cuckoos, orders) exactly as the app does,
 * and check each folder is named after its slug (MF-0024).
 * Returns one line per problem, across all packs; empty means every pack is valid.
 */
export async function validatePacks(root, packsDir, packs) {
  const engine = (path) => import(pathToFileURL(join(root, path)).href);
  const { loadPackFile } = await engine("src/engine/pack/index.ts");
  const { loadPackContent, loadPackOrders } = await engine(
    "src/engine/content/index.ts",
  );
  const problems = [];
  for (const slug of packs) {
    const dir = join(packsDir, slug);
    try {
      const pack = await loadPackFile(join(dir, "pack.yaml"));
      // MF-0024: the sync writes the folder name as pack_slug, so it must be the slug the ids carry.
      if (pack.slug !== slug) {
        problems.push(
          `${slug}: folder "${slug}" holds pack.yaml slug "${pack.slug}"; rename the folder to its slug`,
        );
        continue;
      }
      const content = await loadPackContent(pack, dir);
      // MF-0066: orders validate against the loaded diagrams (second stage).
      await loadPackOrders(pack, dir, content);
    } catch (error) {
      problems.push(`${slug}: ${error.message}`);
    }
  }
  return problems;
}
