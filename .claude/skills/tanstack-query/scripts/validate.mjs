#!/usr/bin/env node
/**
 * tanstack-query: heuristic quality checker (project-agnostic)
 *
 * Scans .ts/.tsx files that import @tanstack/react-query and flags common v5 mistakes.
 * Heuristics are regex-based, so treat WARNINGS as prompts to look, not verdicts.
 *
 * Usage (from the project root; scans src/):
 *   node .claude/skills/tanstack-query/scripts/validate.mjs [path-filter]
 *
 * Examples:
 *   node .claude/skills/tanstack-query/scripts/validate.mjs
 *   node .claude/skills/tanstack-query/scripts/validate.mjs features/todos
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIR = resolve(ROOT, 'src');
const FILTER = process.argv[2] ?? null;
const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '.git']);

const ERRORS = [];
const WARNINGS = [];
const PASSED = [];

// ─── helpers ─────────────────────────────────────────────────────────────────

function walk(dir) {
  const out = [];
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.d\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

const rel = (f) => relative(ROOT, f).replaceAll('\\', '/');
const lineOf = (content, index) => content.slice(0, index).split('\n').length;
const isTest = (f) => /(__tests__|\.test\.|\.spec\.)/.test(f);

/** Run a regex over a file and report each hit. */
function scan(file, content, regex, bucket, tag, message) {
  let hits = 0;
  for (const m of content.matchAll(regex)) {
    bucket.push(`[${tag}] ${rel(file)}:${lineOf(content, m.index)}: ${message}`);
    hits++;
  }
  return hits;
}

// ─── collect ─────────────────────────────────────────────────────────────────

const files = walk(SCAN_DIR)
  .filter((f) => !FILTER || rel(f).includes(FILTER))
  .map((f) => ({ file: f, content: readFileSync(f, 'utf-8') }))
  .filter(({ content }) => /@tanstack\/(react-)?query/.test(content));

if (files.length === 0) {
  console.log(`No files importing @tanstack/react-query under src/${FILTER ? ` matching "${FILTER}"` : ''}.`);
  process.exit(0);
}

// ─── checks ──────────────────────────────────────────────────────────────────

const checks = [
  // v4 APIs that break or silently no-op in v5
  {
    tag: 'v4-positional',
    bucket: ERRORS,
    re: /\buse(?:Suspense)?(?:Infinite)?Query\(\s*\[/g,
    msg: 'positional useQuery(key, fn) is removed in v5. Use the object form / queryOptions',
  },
  {
    tag: 'v4-cacheTime',
    bucket: ERRORS,
    re: /\bcacheTime\s*:/g,
    msg: '`cacheTime` was renamed to `gcTime` in v5',
  },
  {
    tag: 'v4-keepPreviousData',
    bucket: ERRORS,
    re: /\bkeepPreviousData\s*:\s*true/g,
    msg: 'use `placeholderData: keepPreviousData` in v5',
  },
  {
    tag: 'v4-useErrorBoundary',
    bucket: ERRORS,
    re: /\buseErrorBoundary\s*:/g,
    msg: 'renamed to `throwOnError` in v5',
  },
  {
    tag: 'v4-query-callbacks',
    bucket: ERRORS,
    // onSuccess/onError inside a useQuery({...}) or queryOptions({...}) call (not useMutation)
    re: /\b(?:useQuery|useSuspenseQuery|useInfiniteQuery|queryOptions|infiniteQueryOptions)\(\{[^}]*?\bon(?:Success|Error|Settled)\s*:/gs,
    msg: 'query-level onSuccess/onError/onSettled were removed in v5 (they never fire)',
  },
  // Style / correctness heuristics
  {
    tag: 'manual-generic',
    bucket: WARNINGS,
    re: /\buse(?:Suspense)?Query<[^>]+>\(/g,
    msg: 'manual useQuery<T> generic. Let queryOptions() infer the type',
  },
  {
    tag: 'state-copy',
    bucket: WARNINGS,
    re: /useState\(\s*(?:\w+Query\.)?data\b/g,
    msg: 'query data copied into useState. Read the query result or derive with `select`',
  },
  {
    tag: 'refetch-after-mutation',
    bucket: WARNINGS,
    re: /onSuccess[^]*?\brefetch\(\)/g,
    msg: 'refetch() in onSuccess. Prefer invalidateQueries by key prefix',
  },
  {
    tag: 'try-catch-queryFn',
    bucket: WARNINGS,
    re: /queryFn\s*:\s*async[^{]*\{\s*try\s*\{/g,
    msg: 'try/catch in queryFn. Remove it unless it transforms the error (rejections are handled)',
  },
  {
    tag: 'client-in-render',
    bucket: WARNINGS,
    re: /^(?!.*\b(?:useState|useRef)\b).*=\s*new QueryClient\(/gm,
    msg: 'new QueryClient() here. Ensure it is created once (module/browser singleton), not per render',
    skipTests: true,
  },
];

for (const c of checks) {
  let hits = 0;
  for (const { file, content } of files) {
    if (c.skipTests && isTest(file)) continue;
    hits += scan(file, content, c.re, c.bucket, c.tag, c.msg);
  }
  if (hits === 0) PASSED.push(`[${c.tag}] clean`);
}

// Inline query keys outside a queries file (factory not used)
{
  let hits = 0;
  for (const { file, content } of files) {
    if (/queries?\.(ts|tsx)$/.test(file) || /query-options/.test(file) || isTest(file)) continue;
    hits += scan(
      file,
      content,
      /\bqueryKey\s*:\s*\[/g,
      WARNINGS,
      'inline-key',
      'inline queryKey array outside a queries file. Define it in the feature queryOptions factory',
    );
  }
  if (hits === 0) PASSED.push('[inline-key] clean');
}

// fetch() in a queryFn/api file with no visible res.ok check
{
  let hits = 0;
  for (const { file, content } of files) {
    if (/\bfetch\(/.test(content) && !/\.ok\b|throwOnHttpError|ensureOk/.test(content)) {
      WARNINGS.push(`[fetch-ok] ${rel(file)}: fetch() without a visible \`res.ok\` check. 4xx/5xx will resolve, not reject`);
      hits++;
    }
  }
  if (hits === 0) PASSED.push('[fetch-ok] clean');
}

// useMutation with no cache sync anywhere in the file
{
  let hits = 0;
  for (const { file, content } of files) {
    if (/\buseMutation\(/.test(content) && !/invalidateQueries|setQueryData|setQueriesData|removeQueries|resetQueries|router\.(?:refresh|push|replace)|refresh\(\)|navigate\(/.test(content)) {
      WARNINGS.push(`[cache-sync] ${rel(file)}: useMutation without invalidate/setQueryData. Will the screen update?`);
      hits++;
    }
  }
  if (hits === 0) PASSED.push('[cache-sync] clean');
}

// ─── report ──────────────────────────────────────────────────────────────────

const C = { red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', reset: '\x1b[0m', bold: '\x1b[1m' };

console.log(`\n${C.bold}=== tanstack-query: quality checker (${files.length} files) ===${C.reset}\n`);

if (ERRORS.length) {
  console.log(`${C.red}${C.bold}BLOCKERS (${ERRORS.length})${C.reset}`);
  for (const e of ERRORS) console.log(`  ${C.red}✗ ${e}${C.reset}`);
  console.log('');
}
if (WARNINGS.length) {
  console.log(`${C.yellow}${C.bold}WARNINGS (${WARNINGS.length})${C.reset}`);
  for (const w of WARNINGS) console.log(`  ${C.yellow}⚠ ${w}${C.reset}`);
  console.log('');
}
if (PASSED.length) {
  console.log(`${C.green}${C.bold}PASSED (${PASSED.length})${C.reset}`);
  for (const p of PASSED) console.log(`  ${C.green}✓ ${p}${C.reset}`);
  console.log('');
}

process.exit(ERRORS.length ? 1 : 0);
