// another ticket's frozen acceptance tests are red by design until that ticket builds;
// `ticket:verify` for THIS ticket must not count them as its own new failures. The owning ticket's
// own verify still runs them, and judges them, as absolute (`files` mode), so nothing is loosened.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Paths of every acceptance file frozen by a ticket other than `ownTicket`. A missing or
 * unreadable FROZEN.json contributes nothing.
 * @param {string} tasksDir absolute path of `.planning/tasks`
 * @param {string} ownTicket e.g. "MF-0004"
 * @returns {string[]} sorted, repo-relative
 */
export function foreignFrozenPaths(tasksDir, ownTicket) {
  /** @type {Set<string>} */
  const paths = new Set();
  let tickets = [];
  try {
    tickets = readdirSync(tasksDir);
  } catch {
    return [];
  }
  for (const ticket of tickets) {
    if (ticket === ownTicket) continue;
    const manifest = join(tasksDir, ticket, "FROZEN.json");
    if (!existsSync(manifest)) continue;
    try {
      const { files } = JSON.parse(readFileSync(manifest, "utf8"));
      for (const f of Array.isArray(files) ? files : []) {
        if (typeof f?.path === "string") paths.add(f.path);
      }
    } catch {}
  }
  return [...paths].sort();
}

/**
 * vitest CLI arguments that exclude the given paths.
 * @param {string[]} paths
 * @returns {string[]}
 */
export function excludeArgs(paths) {
  return paths.flatMap((p) => ["--exclude", p]);
}
