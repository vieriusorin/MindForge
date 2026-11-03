import { readFile } from "node:fs/promises";
import YAML from "yaml";
import { PackSchema } from "./schema";
import type { Pack } from "./types";

export class PackValidationError extends Error {
  readonly issues: readonly string[];

  constructor(source: string, issues: readonly string[]) {
    super(
      `Invalid pack (${source}):\n${issues.map((i) => `  - ${i}`).join("\n")}`,
    );
    this.name = "PackValidationError";
    this.issues = issues;
  }
}

/** Parse and validate a pack from YAML text. Throws PackValidationError naming each bad path. */
export function parsePack(yamlText: string, source = "inline"): Pack {
  let raw: unknown;
  try {
    raw = YAML.parse(yamlText);
  } catch (error) {
    throw new PackValidationError(source, [
      `yaml: ${(error as Error).message}`,
    ]);
  }
  const result = PackSchema.safeParse(raw);
  if (!result.success) {
    throw new PackValidationError(
      source,
      result.error.issues.map(
        (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      ),
    );
  }
  return result.data;
}

/** Read a pack.yaml file from disk and validate it. */
export async function loadPackFile(filePath: string): Promise<Pack> {
  return parsePack(await readFile(filePath, "utf8"), filePath);
}
