#!/usr/bin/env node
/**
 * PreToolUse (Edit|Write|NotebookEdit): editing a file that can turn a red into a green
 * without fixing anything needs the USER's say-so, not the model's.
 *
 * Returns `permissionDecision: "ask"`, never "deny": all of these files are edited legitimately
 * sometimes (a reviewed gate allowlist entry with its Key Decisions row, a CI fix, an SC the user
 * agreed to change). What must not happen is the model doing it on its own to finish a ticket.
 * Per the hooks reference, "ask" forces a prompt even in auto mode.
 *
 * The closed list is `PROTECTED` in lib/gate-core.mjs, plus every test file named in an active
 * ticket's `.planning/tasks/<ID>/FROZEN.json`. Bash edits are not seen here; `track-changes.mjs`
 * reports those after the fact.
 */
import { protectedReason } from "./lib/gate-core.mjs";
import { activeFrozenMap, readStdinJson, toRel } from "./lib/gate-io.mjs";

function main() {
  const input = readStdinJson();
  if (!input) return;
  const rel = toRel(input.tool_input?.file_path ?? input.tool_input?.notebook_path);
  if (!rel) return;
  const reason = protectedReason(rel, activeFrozenMap());
  if (!reason) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: `Protected-file guard: ${rel} is ${reason}. Approve only if you asked for this change.`,
      },
    }),
  );
}

try {
  main();
} catch {
  // A broken guard must not block an edit; CI and the Stop gate still run.
}
process.exit(0);
