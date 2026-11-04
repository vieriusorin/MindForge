---
ticket: MF-0007
outcome: pass
causes: missing-context, tooling, wrong-plan
actions: memory-update, skill-edit
lesson_keys: windows-tooling-traps, bind-write-to-version-read
applied: 2026-11-04
---
## Numbers
(No `pnpm ticket:retro` script exists; facts taken from the artifacts.)
- Receipt PASS for code-diff hash 610f7c1c: typecheck, lint, 136 unit/ui, 27 DB tests x2, advisors, build, browser.
- Review: round 1 changes-requested (1 blocking), round 2 approve on the same hash.
- Iterations: 1 fix iteration (optional `p_content_hash` + 55000), regression test shown RED then GREEN.
- Frozen: 2 files, 8 tests red at freeze; no refreeze.
- LOOP-PLAN divergences: 6 groups, recorded after BUILD, not before continuing.

## Went right
- Freeze-first with RED lines, then a regression test shown RED before the fix (`mf-0007-content-hash.db.test.ts`, PGRST202 / missing `content_hash`) — keep: already is, `tdd` / gsd-goal-loop verification.
- Fresh-context diff review caught a real design flaw that unit, DB, build and browser checks all passed — keep: already is (Stage 5 review).
- Design choice "no table grants, all access via definer functions" left MF-0005's frozen allow-list untouched — keep: already is, in LOOP-PLAN.

## Went wrong
- The blocking finding (a reviewer's verdict stored against the registry's current hash, not the version the reviewer read) was not anticipated in DESIGN or PLAN. Any write that records a judgement about synced content has a sync/deploy skew window. Cause: missing-context (no design prompt asks "which version did the actor read?"), wrong-plan.
- Divergences (7th definer function, engine additions, out-of-`owns` files) were written into LOOP-PLAN after BUILD, against the loop's rule to record before continuing. Cause: wrong-plan (the plan's `owns` missed `layout.tsx`, `get-pack-content.ts`, etc.).
- Windows tooling cost turns: Docker stack down so baseline `test:db` failed everywhere; Bash heredocs with an apostrophe in a JS string failed 3 times; `stop-gate.mjs` fails every turn with `spawn ... ENOENT` (.cmd shims) though the checks pass directly; agent-scope hook rejected the reviewer's absolute-path Write to REVIEW.md twice; `pnpm db:reset` `SUPABASE_DB_URL= node` fails under cmd. Cause: tooling. The existing memory `windows-dev-environment` covers WDAC, CRLF and `spawn EINVAL` only, so these were rediscovered.

## Actions (at most two)
1. memory-update: `windows-dev-environment.md` — append to the bullet list, before "**How to apply:**":
   ```
   - Docker must be running before `pnpm test:db`; a baseline that fails everywhere means the local stack is down, not the code.
   - Git Bash tool: a heredoc whose JS string holds an apostrophe fails ("unexpected EOF"). Write the script to a file with the Write tool and run it.
   - `.claude/hooks/stop-gate.mjs` fails with `spawn pnpm/biome/vitest ENOENT` (Node won't spawn .cmd shims). Run `pnpm typecheck && pnpm lint && pnpm test` directly; do not chase the hook error. The agent-scope hook can reject a subagent Write to `.planning/tasks/<ID>/REVIEW.md` (absolute Windows path vs pattern): the orchestrator writes it from the reviewer's report.
   - `pnpm db:reset` step `SUPABASE_DB_URL= node ...` fails under cmd: run the sync script by hand.
   ```
   Also change the MEMORY.md line to: `Windows dev environment — WDAC blocks pnpm version switch, CRLF, .cmd spawn (tests, stop hook), heredoc apostrophes, Docker must be up for test:db`. Would have saved: roughly 6 to 8 wasted tool calls and the first failed baseline.
2. skill-edit: `.claude/skills/gsd-goal-loop/SKILL.md`, in the DESIGN stage checklist (add one bullet; if there is no checklist, add it under the DESIGN heading): "Any write that records a judgement about versioned or synced content (review verdict, approval, flag resolution, attempt) must name the version the actor read and refuse when it differs from the stored version. Write that line in the PLAN's risk section; if it is absent the plan is not ready for approval." Would have saved: the blocking review round and fix iteration (migration change, three function signatures, app hashing, one RED/GREEN test).

## Not worth changing
- Divergences recorded late: a one-time lapse, partly a symptom of `owns` being too narrow; no separate action.
- Follow-ups from REVIEW.md notes (return `content_hash` from `list_open_flags`, queue badge count, key `ItemDecision` by `${itemId}@${hash}`): product work, handed to the user, not process.
- Hook failures: hooks are guarded config, nothing was edited; the memory line above is the mitigation. A gate fix (spawn via `shell: true` or `.cmd` resolution in `stop-gate.mjs`) would be worth a ticket if the Stop hook fails again on the next Windows ticket.
- No existing RETRO.md carries a matching `lesson_keys` slug, so these keys are new.

## Applied

2026-11-04, automatic policy:
- Action 1 (memory-update): applied. Four bullets added to `memory/windows-dev-environment.md`, and its MEMORY.md line updated.
- Action 2 (skill-edit, additive): applied. A paragraph added under "Stage 2 — DESIGN" in `.claude/skills/gsd-goal-loop/SKILL.md`. It points at the plan's existing "riskiest step" section, because the plan has no "risk section".
- Held: nothing. No gate action was proposed, so no reserved ticket was created.
