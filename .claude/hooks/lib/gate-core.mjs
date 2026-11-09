/**
 * the pure half of the Claude Code verification hooks.
 *
 * Everything here is a decision with no I/O, so `scripts/__tests__/claude-hooks.test.ts` can
 * assert it. The hooks themselves (`track-changes.mjs`, `guard-protected.mjs`, `stop-gate.mjs`)
 * only gather inputs, call these, and print.
 *
 * Why hooks at all: the skills say "never edit a test to go green" and "run every gate", but a
 * skill is an instruction the model can skip. A hook runs in the harness. The point of this
 * module is that "green" in a hand-off is produced by the toolchain, not asserted by the agent.
 */

/** cmd.exe splits or interprets these; an argument containing one is quoted. */
const WIN_QUOTE_RE = /[\s"&()<>^|]/;
const quoteWin = (a) => (WIN_QUOTE_RE.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

/**
 * MF-0023: how the Stop gate spawns a tool on each platform. Node will not spawn the `.cmd` shims
 * (pnpm, biome, vitest) on Windows without a shell, and a shell joins args unquoted, so win32 gets
 * one quoted command line. POSIX keeps the direct spawn in its own process group, so a timeout can
 * kill the whole tree with `kill(-pid)`.
 * @param {{ cmd: string, args: string[], platform: string }} input
 * @returns {{ command: string, args: string[], shell: boolean, detached: boolean }}
 */
export function spawnSpec({ cmd, args, platform }) {
  if (platform === "win32") {
    return {
      command: [cmd, ...args].map(quoteWin).join(" "),
      args: [],
      shell: true,
      detached: false,
    };
  }
  return { command: cmd, args: [...args], shell: false, detached: true };
}

/** Files whose change can affect typecheck, a gate, lint or a test. Docs and planning cannot. */
const SOURCE_RE = /\.(ts|tsx|mts|cts|mjs|cjs|js|jsx|json|sql|css)$/;
const NEVER_SOURCE_RE = /^(\.planning|node_modules|\.next|public|drizzle\/meta)\//;

/** @param {string} rel repo-relative POSIX path */
export function isRelevantSource(rel) {
  // MF-0046: `gate:workspace` checks this file; a placeholder edit to it alone must still run the gates.
  if (rel === "pnpm-workspace.yaml") return true;
  return SOURCE_RE.test(rel) && !NEVER_SOURCE_RE.test(rel);
}

/**
 * The guard's closed list: files whose edit can turn a red into a green without fixing anything.
 * Order matters only for the reason text; the first match wins.
 * @type {{ test: RegExp, reason: string }[]}
 */
export const PROTECTED = [
  {
    test: /^\.planning\/tasks\/[^/]+\/FROZEN\.json$/,
    reason: "a ticket's frozen acceptance-test manifest (changing it changes the contract)",
  },
  {
    test: /^scripts\/(check-[^/]+|typecheck|verify|freeze-tests|ticket-verify|ticket-eval|agent-night)\.mjs$/,
    reason: "a gate or verification script (allowlist additions need a Key Decisions entry)",
  },
  {
    test: /^scripts\/lib\/(ticket-receipts|ticket-eval|clean-room)\.mjs$/,
    reason: "the rules that decide whether a ticket is done",
  },
  {
    test: /^\.planning\/evidence\/[^/]+\.(receipts\.jsonl|eval\.json)$/,
    reason: "a ticket's receipts — written by the ticket tooling (MF-0080), never by hand",
  },
  { test: /^\.github\//, reason: "CI configuration" },
  { test: /^\.husky\//, reason: "the git hooks" },
  {
    test: /^\.claude\/(settings\.json|hooks\/)/,
    reason: "the Claude Code hooks that enforce the gate",
  },
  {
    test: /^(vitest[^/]*\.config\.ts|biome\.json|eslint\.config\.[cm]?[jt]s|tsconfig[^/]*\.json)$/,
    reason: "test, lint or type-checker configuration",
  },
];

/**
 * @param {string} rel repo-relative POSIX path
 * @param {Map<string, string>} frozen frozen test path -> owning ticket id
 * @returns {string | null} why the path is protected, or null
 */
export function protectedReason(rel, frozen) {
  const ticket = frozen.get(rel);
  if (ticket) {
    return `a frozen acceptance test of ${ticket} (the Success Criteria are the user's to change)`;
  }
  return PROTECTED.find((p) => p.test.test(rel))?.reason ?? null;
}

/**
 * Reads `key: value` lines from a GOAL.md YAML front matter without a YAML dependency.
 * @param {string} text
 * @returns {{ stage: string | null, goalStatus: string | null }}
 */
export function parseGoalFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  const body = m ? m[1] : "";
  const get = (key) => {
    const line = new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m").exec(body);
    return line ? line[1].replace(/^["']|["']$/g, "") : null;
  };
  return { stage: get("stage"), goalStatus: get("goal_status") };
}

/** A ticket whose frozen tests are still a contract. Complete or withdrawn tickets release them. */
export function isActiveGoal(goalStatus) {
  if (!goalStatus) return true;
  return !/^(complete|withdrawn)/.test(goalStatus);
}

/** Before these stages the acceptance tests are EXPECTED to be red: that is the TDD contract. */
const RED_ALLOWED_STAGES = new Set(["intake", "design", "plan", "build"]);
/** From these stages on, the gate runs the full related-test set, not just the cheap tier. */
const FULL_STAGES = new Set(["test", "handoff", "watch"]);

export function redAllowedIn(stage) {
  return stage == null || RED_ALLOWED_STAGES.has(stage);
}

export function fullVerificationIn(stage) {
  return stage != null && FULL_STAGES.has(stage);
}

/**
 * Which paths changed between two `git status` snapshots (path -> mtimeMs, -1 when deleted).
 * A path is changed if it appeared, disappeared, or its mtime moved.
 * @param {Record<string, number>} before
 * @param {Record<string, number>} after
 */
export function diffSnapshots(before, after) {
  const changed = new Set();
  for (const [p, m] of Object.entries(after)) if (before[p] !== m) changed.add(p);
  for (const p of Object.keys(before)) if (!(p in after)) changed.add(p);
  return [...changed].sort();
}

/**
 * The files the gate must verify: touched by this session and changed since the last green run.
 * @param {Record<string, number>} touched path -> mtime when last seen touched
 * @param {Record<string, number>} verified path -> mtime at the last green run
 * @param {Record<string, number>} current path -> mtime now (-1 when deleted)
 */
export function unverifiedFiles(touched, verified, current) {
  return Object.keys(touched)
    .filter((p) => current[p] !== undefined && verified[p] !== current[p])
    .sort();
}

/**
 * The cheap tier: touched test files themselves, plus each touched source file's co-located
 * `__tests__/<base>.test.ts` and its folder's `__tests__/utils*.test.ts` (the component-split
 * layout puts the tested logic in utils.ts).
 * @param {string[]} files repo-relative
 * @param {(p: string) => boolean} exists
 * @param {(dir: string) => string[]} list file names in a directory ([] when absent)
 */
export function colocatedTests(files, exists, list) {
  const out = new Set();
  for (const f of files) {
    if (/\.test\.tsx?$/.test(f)) {
      if (exists(f)) out.add(f);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(f) || !/^(src|scripts)\//.test(f)) continue;
    const slash = f.lastIndexOf("/");
    const dir = f.slice(0, slash);
    const base = f.slice(slash + 1).replace(/\.(ts|tsx)$/, "");
    const testsDir = `${dir}/__tests__`;
    for (const name of list(testsDir)) {
      if (!/\.test\.tsx?$/.test(name)) continue;
      const stem = name.replace(/\.test\.tsx?$/, "");
      if (
        stem === base ||
        stem.startsWith(`${base}-`) ||
        (base === "utils" && stem.startsWith("utils"))
      ) {
        out.add(`${testsDir}/${name}`);
      }
    }
  }
  return [...out].sort();
}

/**
 * Splits a Vitest JSON report into what blocks, what is an expected red (a frozen acceptance test
 * of a ticket still before its TEST stage), and what is infrastructure (the test stack is down,
 * so the suite did not actually run, which is reported as unverified, never as a pass).
 * @param {{ testResults?: { name: string, status: string, message?: string, assertionResults?: { status: string, fullName?: string, failureMessages?: string[] }[] }[] }} report
 * @param {string} root absolute repo root, to relativise names
 * @param {Set<string>} expectedRed repo-relative test files allowed to be red
 */
export function classifyTestResults(report, root, expectedRed) {
  /** @type {{ blocking: string[], expected: string[], infra: string[], passed: number, failed: number }} */
  const out = { blocking: [], expected: [], infra: [], passed: 0, failed: 0 };
  for (const file of report.testResults ?? []) {
    const rel = file.name.startsWith(root) ? file.name.slice(root.length + 1) : file.name;
    const failures = (file.assertionResults ?? []).filter((a) => a.status === "failed");
    out.passed += (file.assertionResults ?? []).filter((a) => a.status === "passed").length;
    out.failed += failures.length;
    if (file.status !== "failed") continue;
    const text = [file.message ?? "", ...failures.flatMap((a) => a.failureMessages ?? [])].join(
      "\n",
    );
    const first = (failures[0]?.fullName ?? file.message ?? "suite failed")
      .split("\n")[0]
      .slice(0, 160);
    const line = `${rel} — ${first}`;
    if (/ECONNREFUSED|connect ECONNREFUSED|Connection terminated unexpectedly/.test(text)) {
      out.infra.push(line);
    } else if (expectedRed.has(rel)) {
      out.expected.push(line);
    } else {
      out.blocking.push(line);
    }
  }
  return out;
}

/**
 * `tsc` diagnostics -> the files they name. `scripts/typecheck.mjs` inherits tsc's stdout, so
 * lines look like `src/x.ts(12,3): error TS2322: ...`.
 * @param {string} output
 */
export function parseTscErrors(output) {
  const out = [];
  for (const line of output.split("\n")) {
    const m = /^(.+?)\((\d+),\d+\): error (TS\d+): (.*)$/.exec(line.trim());
    if (m) out.push({ file: m[1], line: Number(m[2]), code: m[3], message: m[4] });
  }
  return out;
}

/**
 * The Stop decision, as a closed table on (red?, consecutive blocks so far).
 *
 *   red=false               -> pass    (record the green, reset the counter)
 *   red=true, blocks < cap  -> block   (Claude must continue: fix it, or prove it is not its own)
 *   red=true, blocks >= cap -> release (let the turn end, with a RED banner the user cannot miss)
 *
 * The release exists because some reds are not this session's to fix (a parallel session's
 * breakage, a calendar-dependent test). Without it the harness would loop the model eight times
 * and then override anyway, silently. With it, the user always sees what is red.
 * @param {{ red: boolean, blocks: number, cap: number }} input
 * @returns {"pass" | "block" | "release"}
 */
export function decideStop({ red, blocks, cap }) {
  if (!red) return "pass";
  return blocks < cap ? "block" : "release";
}
