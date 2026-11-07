import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pack } from "../pack/types";
import type { Question } from "../questions/types";
import { parseMisconceptions } from "./parse-misconceptions";
import type { PackMisconceptions } from "./types";

/** MF-0065: a pack without a `misconceptions.yaml` tags nothing. */
export const NO_MISCONCEPTIONS: PackMisconceptions = {
  misconceptions: [],
  tags: {},
};

/**
 * MF-0065: read and validate `<packDir>/misconceptions.yaml`. A missing file = no tags; any issue throws
 * (`pnpm check:packs` reports the same issues before a deploy).
 */
export async function loadPackMisconceptions(
  pack: Pack,
  packDir: string,
  questions: readonly Question[],
): Promise<PackMisconceptions> {
  let text: string;
  try {
    text = await readFile(join(packDir, "misconceptions.yaml"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return NO_MISCONCEPTIONS;
    throw error;
  }
  const { data, issues } = parseMisconceptions({
    file: `${pack.slug}/misconceptions.yaml`,
    text,
    pack,
    questions,
  });
  if (!data)
    throw new Error(`Invalid misconceptions:\n  - ${issues.join("\n  - ")}`);
  return data;
}
