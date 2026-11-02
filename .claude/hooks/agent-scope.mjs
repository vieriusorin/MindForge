#!/usr/bin/env node
/**
 * PreToolUse (Edit|Write|NotebookEdit): a role agent writes only inside its scope.
 *
 * Claude Code adds `agent_type` to hook input when the call comes from a subagent. For the role
 * agents listed in lib/agent-scopes.mjs this DENIES (not asks) a write outside their globs: an
 * unattended run has nobody to answer an "ask", and a builder that needs another file should hand
 * that back to the orchestrator, not negotiate. The main session and unlisted agents pass through.
 */
import { SCOPES, scopeDecision } from "./lib/agent-scopes.mjs";
import { readStdinJson, toRel } from "./lib/gate-io.mjs";

function main() {
  const input = readStdinJson();
  if (!input?.agent_type) return;
  const path = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (typeof path !== "string" || path.length === 0) return;
  const rel = toRel(path);
  // Outside the project (another worktree, the main checkout from a night lane, $HOME): a scoped
  // agent has no business there, and no glob could ever have allowed it.
  const reason =
    rel === null
      ? input.agent_type in SCOPES
        ? `${input.agent_type} may not write ${path}: it is outside this project`
        : null
      : scopeDecision(input.agent_type, rel);
  if (!reason) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `Agent scope: ${reason}`,
      },
    }),
  );
}

try {
  main();
} catch {
  // A broken scope hook must not block the session; ticket:eval's scope check is the backstop.
}
process.exit(0);
