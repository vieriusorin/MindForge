import "server-only";
import { join } from "node:path";
import { cacheLife } from "next/cache";
import {
  loadPackMisconceptions,
  type PackMisconceptions,
} from "@/engine/misconceptions";
import { getPack } from "@/server/packs/get-pack";
import { getPackContent } from "./get-pack-content";

/**
 * MF-0065: a pack's misconception tags (`misconceptions.yaml`; none when absent). Versioned with the code and
 * identical for everyone, so cacheable, like `getPackContent`.
 */
export async function getPackMisconceptions(
  slug: string,
): Promise<PackMisconceptions> {
  "use cache";
  cacheLife("days");
  const [pack, content] = await Promise.all([
    getPack(slug),
    getPackContent(slug),
  ]);
  return loadPackMisconceptions(
    pack,
    join(process.cwd(), "packs", slug),
    content.questions,
  );
}
