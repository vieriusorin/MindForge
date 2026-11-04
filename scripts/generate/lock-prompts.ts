/**
 * MF-0008 SC-5: record the prompts' current versions in `prompts/prompt-lock.json`. Refuses when a
 * prompt's body changed without a version bump: bump `version:` in its header first.
 *
 * Usage: pnpm prompts:lock
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parsePrompt, relockPrompts } from "@/content-pipeline/pipeline";
import type { PromptLock } from "@/content-pipeline/types";

const DIR = join(process.cwd(), "prompts");
const LOCK = join(DIR, "prompt-lock.json");

const prompts = readdirSync(DIR)
  .filter((n) => n.endsWith(".md"))
  .sort()
  .map((n) => parsePrompt(readFileSync(join(DIR, n), "utf8")));

let lock: PromptLock = {};
try {
  lock = JSON.parse(readFileSync(LOCK, "utf8"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const next = relockPrompts(prompts, lock);
writeFileSync(LOCK, `${JSON.stringify(next, null, 2)}\n`);
console.log(
  `locked ${prompts.map((p) => `${p.name}@${p.version}`).join(", ")}`,
);
