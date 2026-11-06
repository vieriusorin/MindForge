#!/usr/bin/env node
// MF-0043: `pnpm ticket:collisions <ID>` — every frozen acceptance file that the ticket's
// `## Symbols changed` list reaches and that its "Frozen files this will re-freeze" section has not
// listed. Run at DESIGN (before the checkpoint) and at PLAN. Read-only. Exit 0 clean, 1 hits, 2 error.
// `MF_ROOT` overrides the repo root (tests).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { checkCollisions } from "./lib/frozen-collisions.mjs";

const ROOT = resolve(process.env.MF_ROOT ?? join(import.meta.dirname, ".."));
const TASKS = join(ROOT, ".planning", "tasks");
const ACCEPTANCE = /\.acceptance\.test\.[cm]?[jt]sx?$/;

/** @param {string} message */
function fail(message) {
  console.error(`ticket:collisions: ${message}`);
  process.exit(2);
}

/** @param {string} path */
const readIfExists = (path) =>
  existsSync(path) ? readFileSync(path, "utf8") : null;

/**
 * @param {string} manifest
 * @returns {string[]}
 */
function frozenPaths(manifest) {
  const text = readIfExists(manifest);
  if (text === null) return [];
  try {
    const { files } = JSON.parse(text);
    return Array.isArray(files)
      ? files.map((f) => f?.path).filter((p) => typeof p === "string")
      : [];
  } catch {
    fail(`${relative(ROOT, manifest)} is not valid JSON`);
    return [];
  }
}

/**
 * @param {string} dir
 * @param {string[]} out repo-relative POSIX paths
 */
function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (ACCEPTANCE.test(entry.name))
      out.push(relative(ROOT, full).split(sep).join("/"));
  }
}

const ticket = process.argv[2];
if (!ticket || !/^[A-Z]+-\d{4}$/.test(ticket))
  fail("usage: pnpm ticket:collisions <ID> (e.g. MF-0043)");
const taskDir = join(TASKS, ticket);
if (!existsSync(taskDir))
  fail(`${ticket}: no .planning/tasks/${ticket} folder`);

/** @type {string[]} */
const scan = [];
walk(ROOT, scan);
const tickets = existsSync(TASKS) ? readdirSync(TASKS) : [];
for (const t of tickets) {
  for (const p of frozenPaths(join(TASKS, t, "FROZEN.json"))) {
    if (existsSync(join(ROOT, p))) scan.push(p);
  }
}

const result = checkCollisions({
  ticket,
  goalText: readIfExists(join(taskDir, "GOAL.md")),
  planText: readIfExists(join(taskDir, "LOOP-PLAN.md")),
  ownFrozen: frozenPaths(join(taskDir, "FROZEN.json")),
  files: [...new Set(scan)].map((path) => ({
    path,
    text: readFileSync(join(ROOT, path), "utf8"),
  })),
});

if (result.code === 2) fail(result.message.replace(/^ticket:collisions: /, ""));
for (const hit of result.hits) {
  const [path, line] = [
    hit.replace(/:\d+$/, ""),
    Number(hit.slice(hit.lastIndexOf(":") + 1)),
  ];
  const code = readFileSync(join(ROOT, path), "utf8")
    .replace(/\r\n/g, "\n")
    .split("\n")[line - 1];
  console.log(`${hit}  ${code.trim()}`);
}
console.log(result.message);
process.exit(result.code);
