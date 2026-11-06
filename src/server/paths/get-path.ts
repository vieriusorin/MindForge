import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife } from "next/cache";
import { type PathContent, parsePath } from "@/engine/path";

const PATHS_DIR = join(process.cwd(), "paths");
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * MF-0058: one path file (`paths/<slug>.yaml`), or null when the slug is malformed or no file has
 * it. Paths are versioned files that change only with a deploy: safe to cache, like `getPack`.
 * Throws when the file exists but is invalid (check:packs keeps that out of a deploy).
 */
export async function getPath(slug: string): Promise<PathContent | null> {
  "use cache";
  cacheLife("days");
  if (!SLUG.test(slug)) return null;
  const file = join(PATHS_DIR, `${slug}.yaml`);
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  return parsePath(text, `paths/${slug}.yaml`);
}
