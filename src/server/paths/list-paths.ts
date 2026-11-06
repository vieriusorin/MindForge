import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife } from "next/cache";
import type { PathContent } from "@/engine/path";
import { getPath } from "./get-path";

/** MF-0058: every path under `paths/`, sorted by slug. Same for everyone: cacheable. */
export async function listPaths(): Promise<PathContent[]> {
  "use cache";
  cacheLife("days");
  const names = await readdir(join(process.cwd(), "paths"));
  const slugs = names
    .filter((name) => name.endsWith(".yaml"))
    .map((name) => name.slice(0, -".yaml".length))
    .sort();
  const paths = await Promise.all(slugs.map((slug) => getPath(slug)));
  return paths.filter((path): path is PathContent => path !== null);
}
