import { join } from "node:path";
import { cacheLife } from "next/cache";
import { loadPackContent, type PackContent } from "@/engine/content";
import { getPack } from "@/server/packs/get-pack";

/**
 * MF-0010: every item file of a pack (questions, cards, diagrams). Versioned with the code and
 * identical for everyone, so cacheable; who may see what comes from `getReviewContext`.
 */
export async function getPackContent(slug: string): Promise<PackContent> {
  "use cache";
  cacheLife("days");
  const pack = await getPack(slug);
  return loadPackContent(pack, join(process.cwd(), "packs", slug));
}
