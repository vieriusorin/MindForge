#!/usr/bin/env node
/**
 * MF-0028: `pnpm gate:planning`. Fails when a `.planning/tasks/<dir>/GOAL.md` has more than one
 * `ticket_id:` line (two sessions reserved the same number on separate branches and a merge
 * concatenated them, MF-0022/MF-0023 at 71ac090), none, or one that is not its folder name.
 * Runs in the Stop gate (every `gate:*`) and in CI. Exit 1 on any problem.
 * Usage: node scripts/check-planning.mjs   (MF_TASKS_DIR overrides the folder, for tests)
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPlanning } from "./lib/planning-check.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TASKS = process.env.MF_TASKS_DIR
  ? resolve(process.env.MF_TASKS_DIR)
  : join(ROOT, ".planning", "tasks");

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
    };
  });

const problems = checkPlanning(entries);
if (problems.length > 0) {
  console.log(
    `gate:planning: ${problems.length} problem(s) in .planning/tasks`,
  );
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log(`gate:planning: ${entries.length} ticket folders checked, ok`);
