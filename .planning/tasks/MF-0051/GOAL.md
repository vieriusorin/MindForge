---
ticket_id: MF-0051
title: "check-hooks: referenced pnpm scripts must exist"
tier: high-risk                   # a gate script (scripts/check-hooks.mjs) + hook/agent text; HIGH_RISK binding
stage: handoff
branch: feat/MF-0051
builds_on: [MF-0023, MF-0027, MF-0049]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Reserved 2026-11-05 by the MF-0027 retro (gate action). Claimed 2026-11-09.

## Objective

**Today.** The retro Stop hook tells the agent to run `pnpm ticket:retro <ID>`
(`.claude/hooks/lib/retro-trigger.mjs` ~line 78, header of `.claude/hooks/retro-trigger.mjs`), but `package.json`
has no `ticket:retro` script and `scripts/` has no `ticket-retro.mjs`. MF-0027's retro had to gather its facts by hand.

**End state.** `scripts/check-hooks.mjs` fails when a hook, the settings, an agent, a rule, a skill's code or
`CLAUDE.md` / `AGENTS.md` names `pnpm <name>` where `<name>` is neither a `package.json` script nor a pnpm
built-in. Proof case: today's `pnpm ticket:retro` reference turns it RED. Every reference it finds today is
rewritten to a command that exists.

## Facts (re-derived 2026-11-09 at pickup)

- The drafted rule, run read-only (scratchpad `probe2.mjs`: `.mjs`/`.json` whole text, Markdown code spans and
  fences only, pnpm built-ins allowed) over `.claude/{hooks,agents,rules,skills}`, `.claude/settings.json` and
  `CLAUDE.md`, finds **18 hits**:
  - `pnpm ticket:retro`: `.claude/hooks/lib/retro-trigger.mjs:78`, `.claude/hooks/retro-trigger.mjs:11`, `:97`,
    `.claude/agents/retro.md:3`, `:18`, `:65`, `:87`
  - `pnpm ticket:verify`: `.claude/hooks/lib/gate-core.mjs:68`, `.claude/agents/verifier.md:3`, `:10`, `:13`,
    `.claude/agents/diff-reviewer.md:15`
  - `pnpm ticket:freeze`: `.claude/agents/acceptance-writer.md:33`
  - `pnpm ticket:eval`: `.claude/agents/ticket-planner.md:10`
  - `pnpm verify`: `.claude/hooks/stop-gate.mjs:331`, `.claude/hooks/track-changes.mjs:14`
  - `pnpm db:test:start`: `.claude/hooks/stop-gate.mjs:276`
  - `pnpm for`: `.claude/skills/typescript/SKILL.md:78`, prose inside a plain fenced checklist (lines 77–84)
- Without the code-span scope, the third-party `fallow` and `typescript` skills add ~40 prose or built-in hits
  (`pnpm doesn't`, `pnpm add`, `pnpm catalog`), which is why Markdown is read as code only.
- None of `ticket:verify|freeze|eval|retro`, `verify` or `db:test:start` was ever a `package.json` script
  (`git log -S'"ticket:verify"' -- package.json` is empty). The pure libs exist in `scripts/lib/`
  (`ticket-receipts.mjs`, `ticket-eval.mjs`, `ticket-retro.mjs`) with no CLI.
- `scripts/lib/goal-proofs.mjs:14` already owns a `PNPM_BUILTINS` set (`exec dlx install vitest`) for MF-0049.

## Success Criteria

- [x] **SC-1: the rule.** `unknownPnpmRefs({ text, markdown, scripts })` in `scripts/lib/pnpm-refs.mjs` returns
  `{ line, name }` for each `pnpm <name>` / `pnpm run <name>` whose name is neither in `scripts` nor a pnpm
  built-in. Trailing `.`/`:` is not part of the name. With `markdown: true`, only inline code spans and fenced
  blocks count. Placeholders (`pnpm <script>`, `pnpm ${x}`) and flags (`pnpm --filter`) are not names.
  Proof: `src/test/__tests__/mf-0051-pnpm-refs.acceptance.test.ts` SC-1 cases, including the proof-case line
  `  1. pnpm ticket:retro <ID>   (skip if RETRO.md exists …)` → `[{ line: 1, name: "ticket:retro" }]`.
- [x] **SC-2: wired into check-hooks.** `node scripts/check-hooks.mjs` scans `.claude/hooks/**/*.mjs`,
  `.claude/settings.json`, `.claude/{agents,rules,skills}/**/*.md`, `CLAUDE.md` and `AGENTS.md` under its root,
  prints `path:line pnpm <name>` per hit and exits 1 when any exist. `MF_CHECK_ROOT` points it at another root.
  Proof: the acceptance file SC-2 runs the CLI on a fixture root (a hook file with the proof-case line, an agent
  whose prose names an unknown script `foo` outside code) → exit 1, names `.claude/hooks/x.mjs:2` and the
  `ticket:retro` script, and not `foo`. Also a proof-case replay on today's tree, recorded in LOOP-VERIFY as RED.
- [x] **SC-3: the repo is clean.** The 18 hits are rewritten to commands that exist (see Decided by the user), so
  the rule finds nothing in this repo, and `node scripts/check-hooks.mjs` exits 0.
  Proof: the acceptance file SC-3 walks the real repo with `isPnpmRefFile` + `unknownPnpmRefs` → `[]`, plus
  `node scripts/check-hooks.mjs` exit 0 in LOOP-VERIFY.
- ~~SC-4: one owner for the built-ins.~~ Withdrawn by the user 2026-11-09 (review N-6): "commands that count as an SC
  proof" (`goal-proofs.mjs`) and "pnpm built-ins" are different facts; sharing the set loosened MF-0049's gate.
  `scripts/lib/goal-proofs.mjs` is unchanged against HEAD.

## Constraints → how met

- Hooks, `check-hooks.mjs` and agent files are guarded paths → the user reviews the diff (hand-off lists each).
- The check must not make CI flaky → it is a pure text scan, no spawn; it runs inside the existing CI step
  `node scripts/check-hooks.mjs` (`.github/workflows/ci.yml:50`), so no workflow change is needed.
- A rewritten reference must still tell the agent what to do → each points at the manual default the
  gsd-goal-loop skill already documents (Project bindings: VERIFY / FREEZE / EVAL / RETRO_FACTS), and at MF-0080
  for the CLIs.

## Out of Scope

- Building `ticket:verify|freeze|eval|retro` CLIs → MF-0080 (reserved 2026-11-09, #128).
- Scanning `scripts/**` or `docs/**` for `pnpm` references.
- The pre-existing Windows-only red `mf-0065-check-misconceptions.acceptance.test.ts` SC-8 (path separator);
  green on Linux CI.

## Decided by the user

- 2026-11-09, Q-1: "Check + fix text, reserve CLIs". Rewrite the references to existing procedures; reserve
  MF-0080 for the CLIs.
- 2026-11-09: tier high-risk (gate script). No proof command wipes local state (`db:reset` / `supabase stop`
  not needed).
- 2026-11-09, plan approved as written.
- 2026-11-09, review B-1: re-freeze the acceptance SC-3 walk to skip symlinks (lstat), assertions unchanged; leave
  the tracked `.claude/skills/brag-slim` symlink alone (it dangles on Linux, `.agents/` is untracked).
- 2026-11-09, review N-6: withdraw SC-4; `goal-proofs.mjs` keeps its own proof set.

## Decided without a question

- Scan scope adds `.claude/agents/**`, `.claude/rules/**`, `CLAUDE.md`, `AGENTS.md` to the draft's list: the
  agents hold 11 of the 18 hits, and the draft's intent ("referenced pnpm scripts must exist") covers them.
- Markdown is read as code only (spans + fences): the draft's whole-text rule hits ~40 prose and built-in lines in
  third-party skills, which would be a gate nobody can keep green.
- Built-ins: pnpm's own commands (`add install i dlx exec run remove rm uninstall update up upgrade list ls why
  create init outdated audit store link unlink publish pack prune rebuild import patch patch-commit config env
  setup test start licenses fetch deploy root bin self-update catalog`) plus `vitest` (an installed bin), owned by
  `pnpm-refs.mjs`.
- Review follow-ups fixed in this ticket, each with an inner test shown RED first: separate code spans no longer merge
  into one command; a fence at any indent (list items) opens and closes; `pnpm gate:*` reads as a family, known when
  a script has the prefix. check-hooks' walk skips symlinks (`check-hooks-walk.test.ts`, RED: ENOENT).
- `typescript/SKILL.md:78` "Use pnpm for package management" is reworded ("Manage packages with pnpm") rather than
  special-cased.

## Concerns

- None open. Known limits of the text rule, accepted (review N-1, N-2, N-4): a flag before the name
  (`pnpm -C dir x`, `pnpm --filter w x`, `pnpm run --silent x`) is not checked; a script passed as an argument
  array (`stop-gate.mjs:173` `run("pnpm", ["run", "typecheck"])`) is invisible; a code span split across two lines
  is missed. Candidates for MF-0080's pickup, which rewires these references anyway.

## Iteration Log

- 2026-11-09 design preflight: `pnpm typecheck` 0 · `pnpm lint` 0 · `pnpm test` 1 failed | 1451 passed (pre-existing,
  Windows-only: `mf-0065-check-misconceptions.acceptance.test.ts` SC-8 path separator) · `node scripts/check-hooks.mjs`
  0 (7 hook commands) · `pnpm gate:planning` 0 · main CI `91e6b70` success · `pnpm test:db` not run: no SC names it.
- 2026-11-09 proof-case replay: RED (probe2 over today's tree reports `pnpm ticket:retro` at
  `.claude/hooks/lib/retro-trigger.mjs:78` and 17 more).
- 2026-11-09 iteration 0 review (diff-reviewer, REVIEW.md): changes requested, 1 blocking (B-1 dangling symlink crash on
  Linux CI) + notes. Fixed B-1 (walk skips links; re-freeze approved), N-3/N-4/N-5 parser fixes, stale agent text;
  SC-4 withdrawn by the user. Delta re-reviewed: see LOOP-VERIFY.
- 2026-11-09 hand-off: delta re-reviewed, approve (REVIEW.md, tree `451da4b7…`). SC-1..SC-3 PASS, SC-4 withdrawn.
