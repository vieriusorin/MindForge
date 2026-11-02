/**
 * PT-0315 — the I/O half shared by the verification hooks: session state, git snapshots, and the
 * frozen-test manifests. Decisions live in `gate-core.mjs`.
 *
 * Sessions share one worktree, so "what changed" cannot be read from `git status`: another
 * session's live work is in there too. Each session therefore keeps its OWN set of touched files,
 * fed by Edit/Write tool inputs and by diffing `git status` around every Bash call.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { isActiveGoal, parseGoalFrontmatter } from "./gate-core.mjs";

export const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const STATE_DIR = join(tmpdir(), "claude-p4t-gate");

export function readStdinJson() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return null;
  }
}

/** Absolute or relative tool path -> repo-relative POSIX path, or null if outside the repo. */
export function toRel(p) {
  if (typeof p !== "string" || p.length === 0) return null;
  const rel = relative(ROOT, p.startsWith("/") ? p : join(ROOT, p))
    .split(sep)
    .join("/");
  return rel.startsWith("..") ? null : rel;
}

export function mtimeOf(rel) {
  try {
    return statSync(join(ROOT, rel)).mtimeMs;
  } catch {
    return -1;
  }
}

const safeId = (id) => String(id ?? "no-session").replace(/[^\w-]/g, "");

/**
 * @typedef {{ touched: Record<string, number>, verified: Record<string, number>,
 *   blocks: number, releasedRed: string | null }} GateState
 * @returns {GateState}
 */
export function loadState(sessionId) {
  try {
    const s = JSON.parse(readFileSync(join(STATE_DIR, `${safeId(sessionId)}.json`), "utf8"));
    return { touched: {}, verified: {}, blocks: 0, releasedRed: null, ...s };
  } catch {
    return { touched: {}, verified: {}, blocks: 0, releasedRed: null };
  }
}

export function saveState(sessionId, state) {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(join(STATE_DIR, `${safeId(sessionId)}.json`), JSON.stringify(state));
  } catch {
    // State is best-effort; losing it means the next Stop re-verifies, which is safe.
  }
}

export function snapshotPath(sessionId, toolUseId) {
  return join(STATE_DIR, `${safeId(sessionId)}.bash-${safeId(toolUseId)}.json`);
}

/** Dirty + untracked files right now, path -> mtime. */
export function gitSnapshot() {
  const r = spawnSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  /** @type {Record<string, number>} */
  const out = {};
  if (r.status !== 0) return out;
  const parts = r.stdout.split("\0");
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i];
    if (entry.length < 4) continue;
    const xy = entry.slice(0, 2);
    out[entry.slice(3)] = mtimeOf(entry.slice(3));
    if (xy[0] === "R" || xy[0] === "C") i++; // the next NUL field is the rename source
  }
  return out;
}

/**
 * Every ticket with a FROZEN.json, with its GOAL stage/status.
 * @returns {{ ticket: string, stage: string | null, active: boolean,
 *   files: { path: string, sha256: string }[] }[]}
 */
export function readFrozenManifests() {
  const tasks = join(ROOT, ".planning", "tasks");
  const out = [];
  let dirs = [];
  try {
    dirs = readdirSync(tasks);
  } catch {
    return out;
  }
  for (const ticket of dirs) {
    const manifest = join(tasks, ticket, "FROZEN.json");
    if (!existsSync(manifest)) continue;
    try {
      const m = JSON.parse(readFileSync(manifest, "utf8"));
      const goalPath = join(tasks, ticket, "GOAL.md");
      const goal = existsSync(goalPath)
        ? parseGoalFrontmatter(readFileSync(goalPath, "utf8"))
        : { stage: null, goalStatus: null };
      out.push({
        ticket,
        stage: goal.stage,
        active: isActiveGoal(goal.goalStatus),
        files: Array.isArray(m.files) ? m.files : [],
      });
    } catch {
      out.push({ ticket, stage: null, active: true, files: [], broken: true });
    }
  }
  return out;
}

/** frozen test path -> ticket, for ACTIVE tickets only. */
export function activeFrozenMap() {
  const map = new Map();
  for (const m of readFrozenManifests()) {
    if (!m.active) continue;
    for (const f of m.files) map.set(f.path, m.ticket);
  }
  return map;
}
