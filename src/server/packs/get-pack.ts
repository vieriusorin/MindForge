import { join } from "node:path";
import { cacheLife } from "next/cache";
import { loadPackFile, type Pack } from "@/engine/pack";

const PACKS_DIR = join(process.cwd(), "packs");

/** Packs are versioned files in the repo: safe to cache, they change only with a deploy. */
export async function getPack(slug: string): Promise<Pack> {
  "use cache";
  cacheLife("days");
  if (!/^[a-z0-9-]+$/.test(slug))
    throw new Error(`invalid pack slug "${slug}"`);
  return loadPackFile(join(PACKS_DIR, slug, "pack.yaml"));
}
