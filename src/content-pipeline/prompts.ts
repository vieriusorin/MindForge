import { sha256 } from "./corpus";
import type { Prompt, PromptLock } from "./types";

const HEADER = /^---\nname: ([a-z0-9-]+)\nversion: (\d+)\n---\n([\s\S]*)$/;

/** SC-5: `---\nname: <name>\nversion: <n>\n---\n<body>`; throws without that header. CRLF is read as LF. */
export function parsePrompt(text: string): Prompt {
  const match = HEADER.exec(text.replace(/\r\n/g, "\n"));
  if (!match?.[1] || !match[2] || match[3] === undefined)
    throw new Error(
      "parsePrompt: missing `---\\nname:\\nversion:\\n---` header",
    );
  return { name: match[1], version: Number(match[2]), body: match[3] };
}

export function promptBodyHash(body: string): string {
  return sha256(body.replace(/\r\n/g, "\n"));
}

/**
 * SC-5: names of prompts that changed without a version bump: same version but another body hash,
 * a version below the lock, or a prompt the lock doesn't know. A bumped version is never a violation;
 * `scripts/generate/lock-prompts.ts` then records it.
 */
export function promptLockViolations(
  prompts: Prompt[],
  lock: PromptLock,
): string[] {
  return prompts
    .filter((p) => {
      const locked = lock[p.name];
      if (!locked) return true;
      if (p.version > locked.version) return false;
      if (p.version < locked.version) return true;
      return promptBodyHash(p.body) !== locked.bodyHash;
    })
    .map((p) => p.name);
}

/** The lock after a release: bumped or new prompts recorded; others kept. Throws on a violation. */
export function relockPrompts(prompts: Prompt[], lock: PromptLock): PromptLock {
  const unbumped = promptLockViolations(prompts, lock).filter(
    (name) => lock[name],
  );
  if (unbumped.length > 0)
    throw new Error(
      `relockPrompts: bump the version of ${unbumped.join(", ")} before locking`,
    );
  const next: PromptLock = { ...lock };
  for (const p of prompts)
    next[p.name] = { version: p.version, bodyHash: promptBodyHash(p.body) };
  return next;
}

/** `name@version`, the `generatedBy.prompt` value written on items. */
export function promptRef(prompt: Prompt): string {
  return `${prompt.name}@${prompt.version}`;
}
