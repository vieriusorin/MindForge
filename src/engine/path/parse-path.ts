import YAML from "yaml";
import { PathFileSchema } from "./schema";
import type { PathContent } from "./types";

/**
 * MF-0058: parse and validate a path file (YAML text). Throws `<source>: <field> <message>` for the
 * first problem, so a caller (check:packs) can print it as one line.
 */
export function parsePath(yamlText: string, source = "inline"): PathContent {
  let raw: unknown;
  try {
    raw = YAML.parse(yamlText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${source}: yaml ${message}`);
  }
  const result = PathFileSchema.safeParse(raw);
  if (result.success) return result.data;
  const [issue] = result.error.issues;
  const field = issue?.path.join(".") || "(root)";
  throw new Error(`${source}: ${field} ${issue?.message ?? "invalid path"}`);
}
