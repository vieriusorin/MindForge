---
ticket_id: MF-0060
title: "gate:planning: plan owns must fit each agent's scope, and every changed file must be owned"
tier: high-risk                   # a gate script (scripts/lib/*-check.mjs)
stage: handoff
branch: MF-0060
builds_on: [MF-0058, MF-0048]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Reserved 2026-11-06 from MF-0058 RETRO (action 1, gate). Second occurrence of the lesson
> `plan-assigns-forbidden-paths` (first: MF-0013). Picked up 2026-11-06 in the parallel run MF-0060..MF-0068.

## Objective

**Today.** `pnpm gate:planning` (`scripts/check-planning.mjs`, `scripts/lib/planning-check.mjs`) checks GOAL.md shape,
the design preflight line and the hand-off evidence, but not the LOOP-PLAN task graph against the role agents' write
scopes. MF-0048 added the NEVER rule to `validatePlan` (`scripts/lib/ticket-eval.mjs`), which nothing runs. In MF-0058
the plan gave T4 (`service-builder`) `owns` of `src/features/paths/{schemas,types}.ts`, which
`SCOPES["service-builder"]` in `.claude/hooks/lib/agent-scopes.mjs` refuses (the write was blocked mid-BUILD and moved
to T6), and three changed files (`src/features/paths/utils/path-display.ts` + its test,
`.claude/rules/code-conventions.md`) sat in no task's `owns` (MF-0058 REVIEW should-fix 3).

**End state.** `pnpm gate:planning` runs two new rules over every ticket after MF-0060:
1. **Plan owns** (`checkPlanOwns`): from `stage: plan` on, each LOOP-PLAN task must pass MF-0048's per-task owns check
   (known agent, owns present and readable, no NEVER path for a role agent), and every `owns` glob of a role-agent task
   must lie inside `SCOPES[task.agent]`. `inline` / `orchestrator` tasks are the main session and exempt.
2. **Every changed file owned** (`checkChangedFilesOwned`): at `goal_status: complete-pending-manual-commit`, every file
   the branch changes (diff against the merge base with `main` / `origin/main`, plus untracked) is matched by some
   task's `owns`, unless it is planning state, `package.json`, a file the ticket froze, or a file its RETRO applied.

## Affected

- **Roles:** contributors and the orchestrator writing LOOP-PLANs; the `ticket-planner` agent. No app user sees it.
- **Surfaces:** `scripts/lib/planning-check.mjs`, `scripts/check-planning.mjs` (CI step "Planning check" and the Stop
  gate's GATES step), `.claude/skills/gsd-goal-loop/references/templates.md`.

## Facts (re-derived at pickup, 2026-11-06)

- F-1: the NEVER list is already exported: `NEVER_GLOBS` in `.claude/hooks/lib/agent-scopes.mjs` (MF-0048), read by
  `validatePlan`. The draft's "export `NEVER` / `isNeverWritable`" is done; this ticket does not edit `agent-scopes.mjs`.
- F-2: `validatePlan` has no caller (`package.json` has no `ticket:eval`; MF-0048 F-1, C-1 "MF-0060 wires it").
- F-3: orchestrator convention in shipped plans: `"agent": "inline"` (14 plans) or `"orchestrator"` (MF-0022, MF-0024,
  MF-0046, MF-0048); MF-0048 made both `MAIN_SESSION_AGENTS` in `ticket-eval.mjs`. The "(orchestrator)" title form is in
  3 plans and always beside one of those agent values. Other values seen: `verifier`, `human`, `human+orchestrator`,
  `fork`, `general-purpose`.
- F-4: CI (`.github/workflows/ci.yml`, job `checks`) checks out with `fetch-depth: 0` (MF-0054 T0), so `origin/main` and
  full history exist there; the job `db` does not run `gate:planning`. On a PR the checkout is the merge ref, whose diff
  against `origin/main` is the PR.
- F-5: shipped GOALs keep `goal_status: complete-pending-manual-commit` after merge (48 of 69 folders); there is no
  `merged` value in the tree. On `main` the diff is empty, so rule 2 judges nothing there.
- F-6: RETRO.md is committed in the ticket's own PR (MF-0048 `dc4e9b2`, MF-0058 `cc79c34`), and its skill edits too
  (`templates.md`, `ticket-planner.md` in `cc79c34`). Its `## Applied` section names each edited file in backticks.
- F-7: acceptance tests are written at Stage 2b, before any task exists; MF-0058's two DB acceptance files are in its
  FROZEN.json and in no task's `owns`.
- F-8: there are two glob dialects: `.claude/hooks/lib/util.mjs` `globToRegExp` (`**/` = `(?:.*/)?`, what the scope hook
  enforces) and `ticket-eval.mjs` `globToRegExp` (`**/` folded to `.*`). Scope fit follows the hook's dialect.
- F-9: tickets after MF-0060 in this tree: MF-0061..MF-0069, all at `intake` / `design`, none with a LOOP-PLAN.

## Proof case

- `.planning/tasks/MF-0058/LOOP-PLAN.md` at `cc79c34`, task T4 `owns` `src/features/paths/schemas.ts`, `types.ts` → RED.
- MF-0058's hand-off tree (`git diff be7575d cc79c34`, 114 files): `src/features/paths/utils/path-display.ts`, its test,
  `.claude/rules/code-conventions.md` → RED for rule 2.
- Replay (read-only probe `<scratchpad>/mf-0060/probe/`, 2026-11-06): rule 1 gives 11 lines on MF-0058 (T1R 2 NEVER,
  T3 1 NEVER + 2 scope, T4 2 scope, T5 2 scope, T7 2 NEVER); rule 2 gives exactly the 3 files above once FROZEN.json
  and RETRO `## Applied` files are exempt (without those exemptions it also flagged 2 frozen DB acceptance files and
  the 2 retro-edited skill files). **proof-case replay: RED.**

## Findings: first run over shipped content (read-only, grandfathered, nothing changed)

- Rule 1 over all 44 shipped LOOP-PLANs: 214 lines in 31 plans; 77 are scope-fit lines (the new part), the rest are
  MF-0048's rule (NEVER, `unknown agent` for `verifier`/`fork`/`general-purpose`/`human`, empty `owns`). Recurring
  shapes: `service-builder` given a feature's `schemas.ts`/`types.ts`/`utils/**` (MF-0009, MF-0010, MF-0016, MF-0017,
  MF-0058) or `src/app/**` (MF-0007); docs (`CONTEXT.md`, `docs/**`, `README.md`) given to `service-builder` (MF-0004,
  MF-0011, MF-0013, MF-0017, MF-0021, MF-0058); `src/dev-seed/**` (MF-0034, MF-0052, MF-0059), `src/content-pipeline/**`
  (MF-0008, MF-0022, MF-0030), `prompts/**`, `evals/**`, `paths/**`, `next.config.ts` are in no role's `SCOPES`, so only
  the orchestrator can own them today; evidence files given to `ui-builder` / `verifier` (MF-0007, MF-0016, MF-0017, MF-0058).
- Rule 2 over 33 squash merges on `main` with a plan: 16 had every changed file owned; MF-0059 `660f1c1` 3
  (`src/lib/invite-code.ts` + test, `mf-0059-review-fixes.db.test.ts`), MF-0046 `e60c02a` 1, MF-0058 `cc79c34` 3, MF-0017
  `e3f4993` 3 (incl. `.claude/hooks/stop-gate.mjs`), MF-0013+MF-0052 `8b1aa89` 2, MF-0028 `eb9cc15` 3; older multi-ticket
  merges more.
- The `src/dev-seed/**` / `src/content-pipeline/**` gap is a SCOPES question (out of scope here): proposed follow-up.

## Constraints → how met

- Gate scripts are protected → the user approved this ticket editing `scripts/lib/planning-check.mjs`,
  `scripts/check-planning.mjs` and `templates.md` (orchestrator brief, 2026-11-06); `agent-scopes.mjs` needs no edit (F-1).
- One owner per fact → the NEVER list, the main-session agent names, the plan agents, the owns syntax and the plan
  parser are imported from `agent-scopes.mjs` / `ticket-eval.mjs`, not restated; rule 1 calls `validatePlan` per task.
- Gate parsers fail closed (verification.md §4) → an unknown agent, a missing or unparseable task block past `plan`,
  or an unreadable `owns` glob is a problem line, never a pass. The syntax check runs for exempt main-session tasks too
  (MF-0048 behaviour, kept).
- Must not fail a checkout without `main` → rule 2 runs only when `main` or `origin/main` resolves and a merge base
  exists; otherwise one stdout line `gate:planning: rule 2 skipped: no main ref` and the other rules decide the exit.
  Nothing goes to stderr (frozen MF-0028/MF-0053 CLI tests assert `stderr === ""`).
- Shipped plans must not redden `main` → both rules govern tickets after MF-0060 only (F-9: none of them has a plan yet).

## Decided by the user (2026-11-06, run brief)

- U-1 Merge: the orchestrator commits, pushes, opens the PR and squash-merges after CI. This ticket never commits.
- U-2 Approvals: the orchestrator agent approves the high-risk plan; a fresh-context diff-reviewer runs before merge.
  `pnpm db:reset` on the local stack is allowed under the db lock (not needed here: no SC touches the DB).
- U-3, U-4: not this ticket's (MF-0063, MF-0061).

## Decided without a question (orchestrator under U-2, 2026-11-06; the user may overturn each)

- Q1 → rule 2 runs when `main` or `origin/main` resolves; else it prints `gate:planning: rule 2 skipped: no main ref` and
  passes. CI has `fetch-depth: 0` (F-4), so it runs on PRs. — orchestrator decision Q1.
- Q2 → the existing convention: `"agent": "orchestrator"` or `"inline"` (F-3, MF-0048 `MAIN_SESSION_AGENTS`). The
  "(orchestrator)" title alone does not exempt a task. Stated in templates.md. — orchestrator decision Q2.
- Q3 → by number: tickets after MF-0060 only (MF-0053 precedent "after MF-0052"). — orchestrator decision Q3.
- Rule 1 starts at `stage: plan` (not "past plan"): the Stop gate then shows a bad graph at the plan-approval stop,
  before any builder is dispatched (MF-0058 lost a builder round-trip at BUILD). At `plan` a missing LOOP-PLAN or task
  block is not yet a problem; from `build` on it is. — follows from the RETRO's "Would have saved: one mid-BUILD handoff".
- Rule 1 also runs MF-0048's per-task check (unknown agent, empty/unreadable owns, NEVER), not only scope fit: MF-0048
  C-1 "MF-0060 wires it". Cycle and SC-closure checks stay out (not owns rules). — MF-0048 GOAL C-1.
- A NEVER glob yields MF-0048's NEVER line only, not also a scope line (one actionable line per glob).
- `verifier` and other non-plan agents in a task are `unknown agent` (MF-0048 `PLAN_AGENTS`); a verify step is an
  `orchestrator` task owning `.planning/tasks/<ID>/LOOP-VERIFY.md`. — follows from F-3 + `validatePlan`.
- Rule 2 changed set = `git diff --name-only --no-renames <merge-base>` (working tree vs the merge base, both sides of a
  rename) + `git ls-files --others --exclude-standard`. The merge base is `git merge-base HEAD <main and/or origin/main>`,
  so a stale local `main` does not pull other tickets' merged files into the set. — follows from F-4/F-5.
- Rule 2 judges a hand-off ticket only when its own `.planning/tasks/<ID>/` is in the changed set (the ticket is on this
  branch), and a file is owned by the union of `owns` of every ticket folder in the changed set. — F-5: every shipped
  ticket stays at hand-off forever.
- Rule 2 exemptions beyond the draft's `.planning/**` and `package.json`: files in the FROZEN.json of a ticket in the
  set (F-7) and files named in backticks in the `## Applied` section of its RETRO.md (F-6). Without them the proof case
  and every future retro would be false reds. `pnpm-lock.yaml` is NOT exempt (an `orchestrator` task owns it).
- Scope fit is exact glob inclusion in the hook's dialect (F-8): a glob passes only if no repo path matching it falls
  outside every glob in `SCOPES[agent]`; the problem line names a witness path. Brace sets expand as MF-0048 reads them.
- No `MF_CHANGED_FILES` override: the CLI tests drive real git in temp repos via `MF_REPO_DIR` (default: the repo root),
  beside the existing `MF_TASKS_DIR` / `MF_EVIDENCE_DIR`.

## Success Criteria

Line format used below. `<scope>` is `SCOPES[agent].join(", ")`.
- R1-SCOPE: `<dir>: <task>: <agent> may not own <glob>: <witness> is outside its scope (<scope>). Give it to a task whose agent's scope holds it, or to an "orchestrator" task (SCOPES in .claude/hooks/lib/agent-scopes.mjs)`
- R1-PLAN: `<dir>: <message from validatePlan>` (MF-0048 format, frozen there)
- R1-NOPLAN: `<dir>: stage <stage> but <reason>` where reason is `no LOOP-PLAN.md` or parsePlanTasks' error text
- R2: `<dir>: <file> is changed but in no task's owns. Add it to the owns of the task that wrote it in .planning/tasks/<dir>/LOOP-PLAN.md (an "orchestrator" task for a file no role agent may write)`

- [x] SC-1: `checkPlanOwns` returns one R1-SCOPE line per role-agent `owns` glob (after brace expansion) that can match a
  path outside `SCOPES[agent]`, with the shortest such path as `<witness>`: service-builder `src/features/paths/schemas.ts`
  → witness `src/features/paths/schemas.ts`; service-builder `src/features/**` → witness `src/features/x`; service-builder
  `src/features/paths/{schemas,types}.ts` → two lines. No line for service-builder `src/engine/path/**`,
  `src/features/storm/actions.ts`, `src/features/*/actions/**`; ui-builder `src/app/(app)/paths/[pathSlug]/page.tsx`;
  acceptance-writer `src/features/x/__tests__/a.test.ts`. Proof: `mf-0060-plan-owns.acceptance.test.ts`.
- [x] SC-2: `checkPlanOwns` also returns `validatePlan`'s per-task lines as R1-PLAN (`service-builder` owning
  `scripts/x.mjs` → the NEVER line only, no R1-SCOPE line; agent `verifier` → `T1: unknown agent "verifier"`), and nothing
  for `orchestrator` / `inline` tasks owning `scripts/**` or `package.json`. Proof: acceptance test.
- [x] SC-3: which tickets rule 1 judges: dir after MF-0060, not `goal_status: reserved`, stage in plan · build · test ·
  handoff · watch. At `plan` a missing LOOP-PLAN or task block gives nothing; at `build` it gives R1-NOPLAN
  (`MF-0061: stage build but no LOOP-PLAN.md`; a plan without the block →
  `MF-0061: stage build but LOOP-PLAN.md has no \`\`\`json tasks block`). MF-0060, MF-0058, `stage: design` and
  `reserved` with the same bad plan give nothing. Proof: acceptance test.
- [x] SC-4: `checkChangedFilesOwned(entries, changedFiles)` returns one R2 line per unowned changed file for each judged
  ticket (after MF-0060, `goal_status: complete-pending-manual-commit`, with a changed file under
  `.planning/tasks/<dir>/`). Exempt: any `.planning/**` path, `package.json`, a path in the FROZEN.json `files` of a
  ticket folder in the set, a path in backticks in the `## Applied` section of its RETRO.md. Owned = matched by any
  `owns` glob (braces expanded) of any task of any ticket folder in the set. `changedFiles === null` → `[]`. A hand-off
  ticket whose folder is not in the set, and an in-progress one, give nothing. Proof: acceptance test.
- [x] SC-5: `scripts/check-planning.mjs` runs both rules. In a temp git repo (`MF_REPO_DIR`, `MF_TASKS_DIR`) with branch
  `trunk` and no `main`: stdout has `gate:planning: rule 2 skipped: no main ref`, exit 0, stderr empty. With `main` and
  an untracked `src/x.ts` that the hand-off ticket MF-0061's plan does not own: exit 1 and the R2 line for `src/x.ts`;
  after adding `src/x.ts` to an `orchestrator` task's owns: exit 0. Proof: acceptance test.
- [x] SC-6: proof case. `planOwnsProblems` over MF-0058's plan at `cc79c34` includes the two T4 R1-SCOPE lines
  (`schemas.ts`, `types.ts`) and has 11 lines; `unownedChangedFiles` over `git diff --name-only --no-renames be7575d
  cc79c34` with MF-0058's plan, FROZEN.json and RETRO.md at `cc79c34` is exactly
  `[".claude/rules/code-conventions.md", "src/features/paths/utils/__tests__/path-display.test.ts",
  "src/features/paths/utils/path-display.ts"]`. Proof: acceptance test (reads git objects; CI has full history).
- [x] SC-7: `templates.md` (LOOP-PLAN shape) says `pnpm gate:planning` enforces both rules after MF-0060, that an
  orchestrator-run task is written `"agent": "orchestrator"` (or `"inline"`), and names the two rule-2 exemptions.
  Proof: acceptance test reads the file.
- [x] SC-8: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm gate:planning`, `pnpm gate:workspace` and
  `node scripts/check-hooks.mjs` exit 0 on the hand-off tree, and rule 2 is not skipped there; evidence
  `.planning/evidence/MF-0060.md` has `## See it yourself` (n/a: gate only; the command to run). Proof: the commands.

### Edge inputs (parsers: SC-1..SC-4)

| Input | Result | Decided by |
|---|---|---|
| task `agent` absent or not a string | R1-PLAN `unknown agent "undefined"` (validatePlan) | MF-0048 |
| `owns` absent / `[]` | R1-PLAN `no owns globs` | MF-0048 |
| `owns` entry with a space, `..`, leading `/`, nested braces | R1-PLAN syntax line; no R1-SCOPE line for it | MF-0048 + this GOAL |
| main-session task with an unreadable glob | R1-PLAN syntax line (exempt from NEVER/scope only) | MF-0048 review B2 |
| `owns` glob both NEVER and outside scope | NEVER line only | this GOAL |
| glob equal to a scope glob (`src/engine/**`) | pass | exact inclusion |
| case-variant glob (`Src/engine/x.ts`) | R1-SCOPE (case-sensitive: the hook is) | F-8 |
| task block is not an array / invalid JSON, at build+ | R1-NOPLAN with parsePlanTasks' text | fail closed |
| changed file deleted on the branch | still judged (it is in the diff) | this GOAL |
| renamed file | both paths judged (`--no-renames`) | this GOAL |
| RETRO.md without `## Applied` | no RETRO exemption | this GOAL |
| FROZEN.json unparseable | no FROZEN exemption (fail closed) | this GOAL |
| no `main`/`origin/main`, git missing, no merge base | skip line, rule 2 passes | Q1 |

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | Parallel tickets MF-0062..MF-0068 will be judged once this merges; a plan that gives `.planning/evidence/**` to `ui-builder` or a feature `types.ts` to `service-builder` reddens their `gate:planning` (and the frozen MF-0028/MF-0053 "exits 0 on this repo" tests). Intended; the lines name task, glob, agent and scope. | orchestrator | open: tell each ticket at rebase |
| C-2 | `src/dev-seed/**`, `src/content-pipeline/**`, `prompts/**`, `evals/**`, `paths/**`, docs are in no role's SCOPES, so only an orchestrator task may own them. Widening SCOPES is out of scope. | user | open: proposed follow-up |
| C-3 | A later PR that edits an old hand-off ticket's folder (another ticket's retro writing into it) puts that ticket in the judged set; its files are still owned by the union, so only files no ticket in the PR owns are flagged. | orchestrator | accepted residual |

## Out of Scope

- Changing the scope hook, `SCOPES` or `NEVER_GLOBS` (C-2 is a follow-up).
- Cycle / SC-closure checks of `validatePlan` in the gate, and a `ticket:eval` CLI.
- Rewriting shipped LOOP-PLANs to pass (they are grandfathered; findings above).

## Open questions

- None open; Q1..Q3 decided above.

## Iteration Log

<!-- append-only -->
- 2026-11-06 · intake→design · picked up in the parallel run (issue #94). proof-case replay: RED (rule 1: MF-0058 T4
  `schemas.ts`/`types.ts` among 11 lines; rule 2: exactly `path-display.ts`, its test, `code-conventions.md`; probe in
  `<scratchpad>/mf-0060/probe/`).
- 2026-11-06 design preflight: `pnpm typecheck` exit 0, `pnpm lint` exit 0, `pnpm test` exit 0 (195 files, 1085 tests), `pnpm gate:planning` exit 0 (69 folders), `pnpm gate:workspace` exit 0, `node scripts/check-hooks.mjs` PASS; main CI success on 660f1c1; `pnpm db:reset`, `pnpm test:db`, `pnpm build` not run: no SC touches the DB or a screen.
- 2026-11-06 · design→plan · frozen RED: `mf-0060-plan-owns.acceptance.test.ts` 17 red / 1 green (sha 4aa37eaf…,
  FROZEN.json); full `pnpm test` only this file red (1086 passed). LOOP-PLAN iteration 0: 4 orchestrator tasks;
  `pnpm ticket:collisions MF-0060` exit 0 (Symbols changed: None).
- 2026-11-06 · plan→build · plan approval under U-2: the orchestrator's brief pre-approved the file list
  (planning-check.mjs, check-planning.mjs, templates.md) and Q1..Q3; no edit outside it is planned
  (`agent-scopes.mjs` untouched, F-1). The orchestrator's diff-reviewer is the sign-off.
- 2026-11-07 · build→test · resumed after the usage-limit stop. Stubs replaced; CLI wired (git in `MF_REPO_DIR`);
  templates.md paragraph. RED-first: nested brace set gave 4 extra scope lines (inner test), fixed by refusing depth > 1.
  Frozen hash unchanged (4aa37eaf…). Self-check: both rules over MF-0060's own plan and diff → 0 lines.
- 2026-11-07 · test→handoff · receipt PASS tree 95f1ace87a96: typecheck 0, lint 0, test 1113/1113, gate:planning ok (rule
  2 ran), gate:workspace ok, check-hooks PASS. Reviewer pending (orchestrator, U-2).

- 2026-11-07 · review round 1 APPROVE-WITH-FIXES (95f1ace87a96): finding 1 RED first (`expected [] to deeply equal
  [ Array(1) ]`), fixed (owns union only from folders after MF-0060); finding 2 CI merge-ref inner tests; nits 7, 8, 9.
  Receipt PASS tree 91d7005d5185: typecheck 0, lint 0, test 1116/1116, gate:planning ok, gate:workspace ok,
  check-hooks PASS. Findings 3, 10, 11 left to the orchestrator (3 = follow-up). Delta re-review pending.

### Iteration 0

```yaml
phase: 0-complete
verdict: PASS
started_at: "2026-11-06"
completed_at: "2026-11-07"
```

**Result:** PASS: SC-1..SC-8.
**Suggested commit message:** `MF-0060 feat: gate:planning checks plan owns against agent scopes and that every changed file is owned`
