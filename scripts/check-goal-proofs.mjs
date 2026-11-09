#!/usr/bin/env node
/**
 * MF-0049: `pnpm check:goal-proofs <ID>`. Every Success Criterion's `Proof:` must name paths, test files and pnpm
 * scripts that exist, and every frozen file must be named in the ticket's records. Run in the gsd-goal-loop TEST
 * stage before the fresh-context review. The decision lives in scripts/lib/goal-proofs.mjs; this file reads the disk.
 * `MF_TASKS_DIR` overrides `.planning/tasks` (tests). Exit 1 on any problem, 2 on a usage error.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkGoalProofs } from "./lib/goal-proofs.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TASKS = process.env.MF_TASKS_DIR
  ? resolve(process.env.MF_TASKS_DIR)
  : join(ROOT, ".planning", "tasks");

const id = process.argv[2];
if (!id || !/^[A-Z]+-\d+$/.test(id)) {
  console.error("usage: pnpm check:goal-proofs <ID>   (e.g. MF-0049)");
  process.exit(2);
}

/** @param {string} name */
function record(name) {
  const path = join(TASKS, id, name);
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

let tracked;
try {
  tracked = new Set(
    execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
      .split("\n")
      .map((f) => f.split("/").pop()),
  );
} catch (error) {
  console.error(
    `${id}: cannot list tracked files (git ls-files): ${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const { problems } = checkGoalProofs({
  goalText: record("GOAL.md"),
  planText: record("LOOP-PLAN.md"),
  verifyText: record("LOOP-VERIFY.md"),
  frozenText: record("FROZEN.json"),
  scripts: new Set(Object.keys(pkg.scripts ?? {})),
  exists: (repoPath) => existsSync(join(ROOT, repoPath)),
  isTrackedBasename: (name) => tracked.has(name),
});

if (problems.length > 0) {
  for (const p of problems) console.error(`${id}: ${p}`);
  console.log(`check:goal-proofs: ${id}: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`check:goal-proofs: ${id}: every proof resolves`);
