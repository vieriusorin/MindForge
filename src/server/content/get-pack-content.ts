import { join } from "node:path";
import { cacheLife } from "next/cache";
import { type LoadedPackContent, loadPackContent } from "@/engine/content";
import { getPack } from "@/server/packs/get-pack";

/**
 * MF-0010 / MF-0016: every item file of a pack (questions, cards, diagrams, cuckoos). Versioned with
 * the code and identical for everyone, so cacheable; who may see what comes from `getReviewContext`.
 * Holds answer keys: never pass its items to a client component unmapped.
 */
export async function getPackContent(slug: string): Promise<LoadedPackContent> {
  "use cache";
  cacheLife("days");
  const pack = await getPack(slug);
  return loadPackContent(pack, join(process.cwd(), "packs", slug));
}
