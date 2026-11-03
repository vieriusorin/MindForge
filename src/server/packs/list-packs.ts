import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife } from "next/cache";
import { getPack } from "./get-pack";

export interface PackOption {
  slug: string;
  name: string;
}

/** Every valid pack under packs/, for pickers. Same for everyone: cacheable. */
export async function listPacks(): Promise<PackOption[]> {
  "use cache";
  cacheLife("days");
  const entries = await readdir(join(process.cwd(), "packs"), {
    withFileTypes: true,
  });
  const slugs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  const packs = await Promise.all(slugs.map((slug) => getPack(slug)));
  return packs.map((p) => ({ slug: p.slug, name: p.name }));
}
