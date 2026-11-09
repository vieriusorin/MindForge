#!/usr/bin/env node
/**
 * MF-0028: `pnpm gate:planning`. Fails when a `.planning/tasks/<dir>/GOAL.md` has more than one
 * `ticket_id:` line (two sessions reserved the same number on separate branches and a merge
 * concatenated them, MF-0022/MF-0023 at 71ac090), none, or one that is not its folder name.
 * MF-0053: also fails a GOAL past DESIGN whose SCs name a `pnpm <script>` its "design preflight"
 * Iteration Log line does not mention (script names from this repo's package.json).
 * MF-0055: also fails a ticket after MF-0054 at hand-off whose evidence has no "See it yourself" section.
 * MF-0060: also fails a ticket after MF-0060 whose LOOP-PLAN gives a role agent an `owns` glob outside its SCOPES (or
 * NEVER), and, at hand-off, a changed file (git diff against the merge base with main / origin/main, plus untracked)
 * that no task owns. Without a main ref that second rule is skipped with one line (shallow or detached checkouts).
 * MF-0069: also fails a ticket after MF-0068, from build on, whose LOOP-PLAN owns non-test files under scripts/,
 * .claude/hooks/ or src/engine/ without a `## Parsers` section saying `None: <reason>` or holding complete ### blocks.
 * Runs in the Stop gate (every `gate:*`) and in CI. Exit 1 on any problem.
 * Usage: node scripts/check-planning.mjs   (MF_TASKS_DIR, MF_EVIDENCE_DIR, MF_REPO_DIR override paths, for tests)
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkChangedFilesOwned,
  checkDesignPreflight,
  checkPlanning,
  checkPlanOwns,
  checkPlanParsers,
  checkSeeItYourself,
} from "./lib/planning-check.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TASKS = process.env.MF_TASKS_DIR
  ? resolve(process.env.MF_TASKS_DIR)
  : join(ROOT, ".planning", "tasks");
const EVIDENCE = process.env.MF_EVIDENCE_DIR
  ? resolve(process.env.MF_EVIDENCE_DIR)
  : join(ROOT, ".planning", "evidence");
const REPO = process.env.MF_REPO_DIR ? resolve(process.env.MF_REPO_DIR) : ROOT;

/** @param {string} path */
const readIf = (path) => (existsSync(path) ? readFileSync(path, "utf8") : null);

/**
 * MF-0060: git's stdout, or null on any failure. Pipes stderr so the gate never writes there.
 * @param {string[]} args
 */
function git(args) {
  const run = spawnSync("git", args, {
    cwd: REPO,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return run.status === 0 && !run.error ? run.stdout : null;
}

/**
 * Files this branch changes: the working tree against the merge base of HEAD with main and/or origin/main (both sides
 * of a rename), plus untracked files. null when no main ref resolves or git fails.
 * @returns {string[] | null}
 */
function changedFiles() {
  const refs = ["main", "origin/main"].filter(
    (ref) =>
      git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]) !== null,
  );
  if (refs.length === 0) return null;
  const base = git(["merge-base", "HEAD", ...refs])?.trim();
  if (!base) return null;
  const diff = git(["diff", "--name-only", "--no-renames", "-z", base]);
  const untracked = git(["ls-files", "--others", "--exclude-standard", "-z"]);
  if (diff === null || untracked === null) return null;
  return [...new Set(`${diff}${untracked}`.split("\0").filter(Boolean))];
}

if (!existsSync(TASKS)) {
  console.log("gate:planning: no .planning/tasks folder, nothing checked");
  process.exit(0);
}

const entries = readdirSync(TASKS)
  .sort()
  .filter((dir) => statSync(join(TASKS, dir)).isDirectory())
  .map((dir) => {
    const goal = join(TASKS, dir, "GOAL.md");
    return {
      dir,
      goalText: existsSync(goal) ? readFileSync(goal, "utf8") : null,
      planText: readIf(join(TASKS, dir, "LOOP-PLAN.md")),
      frozenText: readIf(join(TASKS, dir, "FROZEN.json")),
      retroText: readIf(join(TASKS, dir, "RETRO.md")),
    };
  });

const scriptNames = Object.keys(
  JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).scripts ?? {},
);
const changed = changedFiles();
if (changed === null) console.log("gate:planning: rule 2 skipped: no main ref");
const problems = [
  ...checkPlanning(entries),
  ...checkDesignPreflight(entries, scriptNames),
  ...checkSeeItYourself(entries, (dir) => {
    const file = join(EVIDENCE, `${dir}.md`);
    return existsSync(file) ? readFileSync(file, "utf8") : null;
  }),
  ...checkPlanOwns(entries),
  ...checkPlanParsers(entries),
  ...checkChangedFilesOwned(entries, changed),
];
if (problems.length > 0) {
  console.log(
    `gate:planning: ${problems.length} problem(s) in .planning/tasks`,
  );
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log(`gate:planning: ${entries.length} ticket folders checked, ok`);
