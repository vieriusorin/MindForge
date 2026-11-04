import { join } from "node:path";
import { cacheLife } from "next/cache";
import { loadPackContent, type PackContent } from "@/engine/content";
import { getPack } from "@/server/packs/get-pack";

/** Content files are versioned with the code and identical for everyone: cacheable. */
export async function getPackContent(slug: string): Promise<PackContent> {
  "use cache";
  cacheLife("days");
  const pack = await getPack(slug);
  return loadPackContent(pack, join(process.cwd(), "packs", slug));
}
