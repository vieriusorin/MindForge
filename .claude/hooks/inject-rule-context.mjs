#!/usr/bin/env node
/**
 * PreToolUse (Edit|Write) — path-matched rule injection.
 *
 * Replaces the old always-on `.claude/rules/*.md` load (~15k tokens every session)
 * with a ~200-token digest delivered only when a matching file is actually touched.
 * The digest is a reminder plus a pointer; the full rule lives in the paired skill.
 *
 * Never blocks. Any failure exits 0 silently — a broken hook must not stop an edit.
 * Each digest is injected at most once per session (state in the OS temp dir).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** @type {{ id: string, test: RegExp, skill: string, text: string }[]} */
const RULES = [
  {
    id: "rsc-page",
    test: /src\/app\/.*(page|layout|template)\.tsx$/,
    skill: "nextjs-data",
    text: `RSC page/layout. Next.js 16 with Cache Components ON (\`cacheComponents: true\`) — read \`node_modules/next/dist/docs/\` before using an API.
- Uncached async work (cookies(), auth, per-user reads) must sit under a \`<Suspense>\` with a real fallback.
- NEVER \`export const runtime | dynamic | revalidate | fetchCache\`, \`unstable_cache\`, \`unstable_noStore\`.
- \`"use cache"\` + \`cacheLife\` only for data identical for everyone (pack files). NEVER for a learner's memory, answers, group data or anything per-user.
- The page IS the container: read in parallel (\`Promise.all\`), call the engine (e.g. \`buildForest\`) and pass the result down. No game or scoring logic in the page or in components.`,
  },
  {
    id: "engine",
    test: /src\/engine\//,
    skill: "typescript-strict",
    text: `Learning engine (\`src/engine/**\`). Pure TypeScript: no React, no Next, no DB, no network.
- Pack-agnostic: never mention a pack slug (\`ccdv\`, …) — a frozen test greps for it (spec G6).
- Game state = memory state: rewards and tree stages come only from measured recall (stability, retrievability, correct answers, Feynman/storm results). Never from time-in-app or clicks.
- Thresholds live in one exported \`as const\` object; changing one changes every learner's forest — needs a ticket.
- Every change gets oracle tests in a co-located \`__tests__/\` with literal expected values from the spec.`,
  },
  {
    id: "packs",
    test: /(^|\/)packs\/.*\.ya?ml$/,
    skill: "ticket-traceability",
    text: `Pack file. Data, validated by \`src/engine/pack/schema.ts\` (weights sum per domain and to 100, ±0.05; unique codes).
- Exam facts (domain/skill names, weights, question count, pass score) are copied from the official source named in \`source:\` — never invented or "rounded nicer".
- Skill codes are stable IDs: learners' memory is keyed by them. Renaming a code orphans everyone's progress — add, don't rename.`,
  },
  {
    id: "ai-prompts",
    test: /(^|\/)prompts\/|src\/server\/ai\//,
    skill: "claude-api",
    text: `AI service / prompt. Every generated item stores \`prompt_version\` and \`model\`, carries citations to official docs, and is a draft until 2 human approvals.
- Analogies must fill "where it breaks". Structured output validated with Zod before it is stored.
- Pasted notes and fetched pages are UNTRUSTED: keep them in a delimited data block, never in instructions, and they can never change an item's status.`,
  },
  {
    id: "tests",
    test: /__tests__\/.*\.test\.tsx?$|^e2e\/|\/e2e\//,
    skill: "testing-strategy",
    text: `Test file. Vitest (\`pnpm test\`), node environment, files under \`src/**/__tests__/\`.
- No snapshot tests. Expected values come from the requirement/spec, never from calling the code under test.
- React Testing Library, msw and Playwright are NOT installed — propose before adding.
- A test listed in a ticket's \`FROZEN.json\` is the contract: never edit it to go green (the guard hook asks the user).
- Full check: \`pnpm typecheck && pnpm lint && pnpm test && pnpm build\`. The Stop gate runs the fast half for you.`,
  },
];

const FOOTER = (skill) => `\n(Full rule: \`${skill}\` skill — load it if you need the detail.)`;

function main() {
  let raw = "";
  try {
    raw = readFileSync(0, "utf8");
  } catch {
    return;
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return;
  }

  const filePath = input?.tool_input?.file_path;
  if (typeof filePath !== "string" || filePath.length === 0) return;

  const matched = RULES.filter((r) => r.test.test(filePath));
  if (matched.length === 0) return;

  // Per-session dedupe: a digest is worth ~200 tokens once, not on every edit.
  const sessionId = String(input?.session_id ?? "no-session").replace(/[^\w-]/g, "");
  const stateDir = join(tmpdir(), "claude-mf-rule-hook");
  const statePath = join(stateDir, `${sessionId}.json`);

  /** @type {string[]} */
  let seen = [];
  try {
    if (existsSync(statePath)) seen = JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    seen = [];
  }

  const fresh = matched.filter((r) => !seen.includes(r.id));
  if (fresh.length === 0) return;

  try {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(statePath, JSON.stringify([...seen, ...fresh.map((r) => r.id)]));
  } catch {
    // Dedupe is an optimization; proceed without it rather than dropping the injection.
  }

  const additionalContext = fresh.map((r) => `${r.text}${FOOTER(r.skill)}`).join("\n\n---\n\n");

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext: `MindForge rules for \`${filePath}\`:\n\n${additionalContext}`,
      },
      suppressOutput: true,
    }),
  );
}

try {
  main();
} catch {
  // Never block an edit because the reminder hook failed.
}
process.exit(0);
