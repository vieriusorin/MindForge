import { join } from "node:path";
import { cacheLife } from "next/cache";
import { itemHashes, readPackFiles } from "@/engine/content";

/**
 * MF-0007: the content hash of every item in the DEPLOYED files, keyed by item id: the version a
 * reader of this deployment sees. Files are identical for everyone and change only with a
 * deploy, so this is cacheable like `getPackContent`.
 */
export async function getItemHashes(
  slug: string,
): Promise<Record<string, string>> {
  "use cache";
  cacheLife("days");
  if (!/^[a-z0-9-]+$/.test(slug))
    throw new Error(`invalid pack slug "${slug}"`);
  return itemHashes(await readPackFiles(join(process.cwd(), "packs", slug)));
}
