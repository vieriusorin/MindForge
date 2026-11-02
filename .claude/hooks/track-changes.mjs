#!/usr/bin/env node
/**
 * PT-0315 — records which files THIS session changed, for `stop-gate.mjs`.
 *
 *   PreToolUse  Bash                  -> snapshot `git status` (+ mtimes)
 *   PostToolUse Bash                  -> diff against the snapshot; the delta is this session's
 *   PostToolUse Edit|Write|NotebookEdit -> the tool's file_path is this session's
 *
 * A protected file (a frozen test, a gate script, CI, these hooks) changed through Bash bypassed
 * `guard-protected.mjs`, which only sees Edit/Write. That is reported to Claude AND to the user
 * rather than blocked: the command already ran, and the point is that nobody misses it.
 *
 * Never blocks a tool call and never fails loudly: a broken tracker must not stop work. The cost
 * of a miss is a Stop gate that verifies less, and `pnpm verify` / CI still run everything.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { diffSnapshots, protectedReason } from "./lib/gate-core.mjs";
import {
  activeFrozenMap,
  gitSnapshot,
  loadState,
  mtimeOf,
  readStdinJson,
  saveState,
  snapshotPath,
  toRel,
} from "./lib/gate-io.mjs";

function record(sessionId, rels) {
  if (rels.length === 0) return;
  const state = loadState(sessionId);
  for (const rel of rels) state.touched[rel] = mtimeOf(rel);
  saveState(sessionId, state);
}

function main() {
  const input = readStdinJson();
  if (!input) return;
  const { hook_event_name: event, tool_name: tool, session_id: sessionId } = input;

  if (tool === "Bash" && event === "PreToolUse") {
    writeFileSync(snapshotPath(sessionId, input.tool_use_id), JSON.stringify(gitSnapshot()));
    return;
  }

  if (tool === "Bash" && event === "PostToolUse") {
    const snap = snapshotPath(sessionId, input.tool_use_id);
    if (!existsSync(snap)) return;
    const before = JSON.parse(readFileSync(snap, "utf8"));
    rmSync(snap, { force: true });
    const changed = diffSnapshots(before, gitSnapshot());
    record(sessionId, changed);

    const frozen = activeFrozenMap();
    const hits = changed
      .map((rel) => ({ rel, reason: protectedReason(rel, frozen) }))
      .filter((h) => h.reason);
    if (hits.length === 0) return;
    const list = hits.map((h) => `  - ${h.rel}: ${h.reason}`).join("\n");
    process.stdout.write(
      JSON.stringify({
        systemMessage: `⚠ Protected file(s) changed through Bash, bypassing the edit guard:\n${list}`,
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: `This Bash command changed protected file(s) that the guard would have asked the user about:\n${list}\nTell the user explicitly what you changed there and why. If it was not intended, say so; do not revert other sessions' work.`,
        },
      }),
    );
    return;
  }

  if (event === "PostToolUse") {
    const rel = toRel(input.tool_input?.file_path ?? input.tool_input?.notebook_path);
    if (rel) record(sessionId, [rel]);
  }
}

try {
  main();
} catch {
  // Never fail a tool call because the tracker failed.
}
process.exit(0);
