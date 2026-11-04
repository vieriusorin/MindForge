---
ticket: MF-0008
outcome: pass
causes: known-trap-repeated, tooling, missing-context
actions: gate, skill-edit
lesson_keys: stop-hook-windows-spawn, load-external-api-skill-before-sc, mocked-tests-miss-real-input
applied: 2026-11-04
---
## Numbers
No `pnpm ticket:retro` script exists; facts come from GOAL.md, LOOP-PLAN.md, LOOP-VERIFY.md and the orchestrator.
- Tier normal, 10 frozen tests, 6 plan tasks, receipt PASS. No fresh-context review ran.
- 1 SC change after the user confirmed the SCs (SC-2 custom_id), 2 plan divergences recorded.
- Stop hook red (spawn ENOENT) on every turn.
- Full-pack writer estimate $70.41 against a $25 cap, so paid runs moved to MF-0022.

## Went right
- Real `pnpm generate:corpus` run before hand-off exposed PDF-as-text and inline-MDX pages (1.29M chars) that mocked tests could not. The fix was written test-first and recorded as a divergence before continuing. Keep: already is, in the LOOP-PLAN divergence rule. Add the "run the real command once" line to the skill edit below.
- Cost estimate caught the $25 cap breach before any paid run, and the paid runs were moved to MF-0022. Keep: already is, in GOAL.md.
- The grill against CONTEXT.md added the Source and Citation terms before freeze.

## Went wrong
- SC-2 `custom_id` `<skill>.<i>` violated the Batches pattern `^[a-zA-Z0-9_-]{1,64}$`. It was found only when the claude-api skill and live docs were read while writing the test, after the user had confirmed the SCs. The GOAL draft already said "load the claude-api skill before choosing model ids or batch syntax", and DESIGN skipped it. Cause: known-trap-repeated. A written note in GOAL.md was not loaded at the moment SCs were written.
- The Stop hook `.claude/hooks/stop-gate.mjs` failed with spawn ENOENT on every turn (Windows .cmd shims). It is already in memory, and the MF-0007 retro said to build a gate ticket if it failed again. It did. Cause: tooling and known-trap-repeated.
- Node `String.replace` with `$\`` in the replacement pasted 5,398 characters into GOAL.md. Heredoc apostrophes broke Bash three more times, and a sed pattern missed. Cause: tooling. Heredoc apostrophes are already in memory `windows-dev-environment`.

## Actions (at most two)
1. gate: `.claude/hooks/stop-gate.mjs` — on `process.platform === "win32"`, spawn through the shell (`spawn(cmd, args, { shell: true })`) or call `pnpm.cmd`/`corepack`. Add a unit test or smoke run that the hook exits 0 on a clean tree on Windows. Would have saved the red hook on every turn of MF-0008 and MF-0007, and the noise that hides real failures.
2. skill-edit: `.claude/skills/gsd-goal-loop/references/design.md` (the DESIGN stage reference). Add this under the SC-writing step: "Before writing any SC that names an external API's wire format, id pattern, limit or model id, load the matching skill (for example `claude-api`) and read the live reference. Paste the constraint into the SC. Before hand-off, run the real command once against real input. Mocks do not prove input shape." Would have saved the post-confirmation SC change and the user re-approval.

## Not worth changing
- The `$\`` replace mishap: add one line to memory `windows-dev-environment`: "JS `String.replace` expands `$\``, `$&` and `$'` in the replacement string. Use a function replacer or the Edit tool." Held back by the two-action limit. It is cheap if the orchestrator wants it.
- The sed pattern miss and the heredoc apostrophes (already in memory).
- No fresh-context review ran at tier normal. That follows policy, not a defect.

## Applied

2026-11-04, automatic policy:
- Action 1 (gate): reserved as **MF-0023** (`.planning/tasks/MF-0023/GOAL.md`, goal_status: reserved). Not built: hooks are guarded config, and the policy never builds gates.
- Action 2 (skill-edit, additive): applied in `.claude/skills/gsd-goal-loop/SKILL.md` under "Stage 2 — DESIGN". The retro named `references/design.md`, which does not exist; the DESIGN stage lives in SKILL.md.
- Also applied (memory, from "Not worth changing", cheap): the `String.replace` `$`` line in memory `windows-dev-environment`.
- Held: nothing.
