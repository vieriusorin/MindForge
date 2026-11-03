// PT-0363 — the pure decisions behind `agents:night`'s parallel lanes: how many lanes, which
// tickets are schema tickets (they never overlap: a migration on the one shared test DB outlives
// the command that applied it), when a lane touched the schema without that lock, and when a
// session that has written nothing counts as stalled. `claude -p --output-format json` prints
// nothing until it exits, so silence on stdout means nothing; the transcript directory is the
// signal.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parsePlanTasks } from "./ticket-eval.mjs";

export const DEFAULT_LANES = 4;
export const DEFAULT_STALL_MINUTES = 20;

const SCHEMA_PREFIXES = ["src/server/db/", "drizzle/"];
const SCHEMA_CHANGE_PREFIXES = ["drizzle/", "src/server/db/schema/"];

/**
 * @param {string[]} argv @param {number} readyCount
 * @returns {{ parallel: number, stallMinutes: number }}
 */
export function nightOptions(argv, readyCount) {
  if (argv.includes("--ticket-hours")) {
    throw new Error(
      "--ticket-hours was removed (PT-0363): a lane now ends on budget, iterations or a stall — use --stall-minutes",
    );
  }
  // A missing or non-numeric value falls back to the default instead of NaN workers (no night).
  const opt = (f) => {
    const n = argv.includes(f) ? Number(argv[argv.indexOf(f) + 1]) : Number.NaN;
    return Number.isFinite(n) ? n : null;
  };
  const asked = opt("--parallel");
  const parallel = Math.max(1, asked ?? Math.min(readyCount, DEFAULT_LANES));
  const stall = opt("--stall-minutes");
  return {
    parallel,
    stallMinutes: stall && stall > 0 ? stall : DEFAULT_STALL_MINUTES,
  };
}

/**
 * A ticket with no plan yet is treated as a schema ticket: its plan is written during the night.
 * @param {{ planText: string | null }} input @returns {boolean}
 */
export function isSchemaTicket({ planText }) {
  const { tasks } = parsePlanTasks(planText);
  if (tasks.length === 0) return true;
  return tasks.some(
    (t) =>
      t.agent === "schema-builder" ||
      (t.owns ?? []).some((o) => SCHEMA_PREFIXES.some((p) => o.startsWith(p))),
  );
}

/** @param {boolean} isSchema @param {string[]} changedPaths @returns {string[]} */
export function schemaViolation(isSchema, changedPaths) {
  if (isSchema) return [];
  return changedPaths.filter((p) =>
    SCHEMA_CHANGE_PREFIXES.some((x) => p.startsWith(x)),
  );
}

/**
 * @param {{ now: number, startedAt: number, lastActivityMs: number, stallMs: number }} input
 * @returns {boolean}
 */
export function isStalled({ now, startedAt, lastActivityMs, stallMs }) {
  return now - Math.max(startedAt, lastActivityMs) > stallMs;
}

/** Newest mtime (ms) of any file under `dir`, recursively; 0 when the dir does not exist. */
export function newestMtime(dir) {
  if (!existsSync(dir)) return 0;
  let newest = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue; // removed between readdir and stat
    }
    newest = Math.max(newest, st.isDirectory() ? newestMtime(p) : st.mtimeMs);
  }
  return newest;
}
