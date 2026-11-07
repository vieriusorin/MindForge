---
phase: 0-planning
ticket_id: MF-0060
status: executing
verdict: IN_PROGRESS
started_at: "2026-11-06"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 0

## Discovery summary

- `scripts/check-planning.mjs` (63 lines) reads each `.planning/tasks/<dir>/GOAL.md` and runs three pure checks from
  `scripts/lib/planning-check.mjs` (`checkPlanning` MF-0028, `checkDesignPreflight` MF-0053 with cutoff `MF-0052`,
  `checkSeeItYourself` MF-0055 with cutoff `MF-0054`). Overrides `MF_TASKS_DIR`, `MF_EVIDENCE_DIR` exist for tests.
- `scripts/lib/ticket-eval.mjs` (MF-0048) exports `parsePlanTasks`, `validatePlan`, `globsOverlap`, `PLAN_AGENTS`,
  `MAIN_SESSION_AGENTS`; `validatePlan` holds the per-task owns rules (unknown agent, empty owns, OWNS_SEGMENT syntax,
  brace expansion, NEVER overlap case-folded). It has no caller (GOAL F-2). Not edited here (not in the approved list):
  rule 1 calls `validatePlan` once per task with `depends_on: []` and no SC ids, so only the per-task lines come back.
- `.claude/hooks/lib/agent-scopes.mjs` exports `SCOPES` and `NEVER_GLOBS` (F-1); the hook matches with
  `.claude/hooks/lib/util.mjs` `globToRegExp` (F-8). Not edited.
- Gates the touched paths sit on: `scripts/**` and `.claude/**` are NEVER for role agents and guarded for the main
  session (approved by the orchestrator brief for this ticket). Frozen tests that run the CLI on this repo:
  `mf-0028-planning-check.acceptance.test.ts` ("exits 0 on this repo's .planning/tasks", stderr ""), and
  `mf-0053-design-preflight.acceptance.test.ts` (same). Both stay green: no ticket after MF-0060 has a plan (F-9), and
  rule 2 in this worktree judges no ticket after MF-0060 (MF-0060 itself is grandfathered).
- Precedent: MF-0053 (a cutoff constant, a pure check + CLI wiring, CLI tests with `MF_TASKS_DIR`).

## Symbols changed

None. Four functions are added to planning-check.mjs; no existing function, set or shared shape changes. The CLI adds
one stdout line only when rule 2 is skipped.

## Frozen files this will re-freeze

None. Read and still holding: `src/test/__tests__/mf-0028-planning-check.acceptance.test.ts` (SC-4 CLI cases use
fixture tickets MF-0001..MF-0004, below every cutoff; "exits 0 on this repo" holds per Discovery),
`src/test/__tests__/mf-0053-design-preflight.acceptance.test.ts` (fixtures MF-0060 at `build` with no LOOP-PLAN, and
MF-0061 at `design`: MF-0060 is not after the cutoff, MF-0061 is before `plan`; its assertions are `toContain` and
exit 1, unaffected), `src/test/__tests__/mf-0048-plan-never.acceptance.test.ts` (ticket-eval.mjs unchanged).

## Parsers

1. **`owns` globs (rule 1 scope fit).** Grammar: what MF-0048's `OWNS_SEGMENT` accepts, braces expanded the same way
   (non-nested, at most 64). The syntax check is `validatePlan`'s and runs first for every task, main-session included;
   scope fit runs only for a `PLAN_AGENTS` task, only on a string glob that expands, and only when the alternative does
   not overlap a NEVER glob (that glob already has its NEVER line). Matching dialect: util.mjs (`**/` = `(?:.*/)?`,
   `**` = `.*`, `*` = `[^/]*`, `?` = `[^/]`). Inclusion is exact: a product BFS over the glob's NFA and the subset state
   of the union of the scope NFAs, alphabet = every literal char + `/` + one "other" char (rendered `x`, or the first of
   `xyzqjkw` not used as a literal). The witness is the shortest path, restricted to repo-path shape (non-empty, no
   leading, trailing or doubled `/`). Rejected inputs: see GOAL edge table (agent absent, owns absent/empty, space, `..`,
   leading `/`, nested braces, case variants).
   Exempt-path test: an `orchestrator` task with an unreadable glob still gets the syntax line (MF-0048 behaviour; inner
   test). Cross-check: inner test enumerates every path up to length 6 over the alphabet `{a, b, /, x}` for a set of
   glob × scope pairs and compares "some path matches the glob and no scope glob" (util.mjs regexes) with
   `globEscapesScope` returning non-null.
2. **LOOP-PLAN task block.** `parsePlanTasks` (MF-0048, unchanged). From `build` on: no file → `no LOOP-PLAN.md`; its
   error text otherwise. At `plan`: absent file or block → nothing.
3. **RETRO.md `## Applied`.** The body from a line `## Applied` to the next `## ` heading or EOF; every backticked token
   without whitespace is an exempt path. Absent section → no exemption. CRLF normalised.
4. **FROZEN.json.** `JSON.parse`, then `files[].path` strings. Unparseable or not that shape → no exemption.
5. **git changed set.** `git rev-parse --verify --quiet <ref>^{commit}` for `main`, `origin/main` (refs/heads and
   refs/remotes); `git merge-base HEAD <found refs…>`; `git diff --name-only --no-renames -z <base>` and
   `git ls-files --others --exclude-standard -z`. Any failure → skipped (null). `stdio` pipes, so git writes nothing to
   the gate's stderr. Ticket folder from a changed path: `^\.planning/tasks/([^/]+)/`.

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1 | 1, 2 | `mf-0060-plan-owns.acceptance.test.ts` SC-1 (4 cases) + inner cross-check |
| SC-2 | 1 | acceptance SC-2 |
| SC-3 | 1 | acceptance SC-3 |
| SC-4 | 1 | acceptance SC-4 |
| SC-5 | 3 | acceptance SC-5 (temp git repos) |
| SC-6 | 1 | acceptance SC-6 (git objects of cc79c34) |
| SC-7 | 4 | acceptance SC-7 |
| SC-8 | 5 | the commands, LOOP-VERIFY receipt, evidence |

## Steps

1. `scripts/lib/planning-check.mjs` — replace the four stubs: `globEscapesScope(glob, scopeGlobs)` (witness or null),
   `planOwnsProblems(tasks)`, `checkPlanOwns(entries)` (cutoff `MF-0060`, stages plan+, reserved skipped, R1-NOPLAN),
   `unownedChangedFiles(changedFiles, tickets)`, `checkChangedFilesOwned(entries, changedFiles)`. Imports from
   `agent-scopes.mjs` (`SCOPES`, `NEVER_GLOBS`), `util.mjs` (`globToRegExp`), `ticket-eval.mjs` (`parsePlanTasks`,
   `validatePlan`, `globsOverlap`, `PLAN_AGENTS`).
2. `src/test/__tests__/planning-check-owns.test.ts` — inner tests: brute-force cross-check of `globEscapesScope`;
   witness shape (no trailing `/`); exempt-path syntax case; RETRO without Applied; bad FROZEN.json; deleted and
   renamed files are judged like any other path.
3. `scripts/check-planning.mjs` — read LOOP-PLAN.md, FROZEN.json, RETRO.md per folder; `changedFiles()` via git in
   `MF_REPO_DIR` (default ROOT); print the skip line when null; add both rules to `problems`.
4. `.claude/skills/gsd-goal-loop/references/templates.md` — LOOP-PLAN shape: the gate enforces both rules after MF-0060
   (`checkPlanOwns`, `checkChangedFilesOwned`), main-session tasks are `"agent": "orchestrator"` (or `"inline"`), a
   verify step is an orchestrator task owning LOOP-VERIFY.md, and the rule-2 exemptions (FROZEN.json, RETRO `## Applied`).
5. Ladder: typecheck, lint, test, gate:planning, gate:workspace, check-hooks; LOOP-VERIFY.md; evidence.

## Riskiest step

Step 3, rule 2 in CI: a false red on every PR. Cases: (a) a merged ticket stays at hand-off forever (F-5): judged only
when its folder is in the diff; (b) a stale local `main`: the merge base with `HEAD` is used, never `main` itself;
(c) shallow or detached checkouts: any git failure skips with the one line, never stderr; (d) retros and frozen files:
exempt by their own records. The frozen MF-0028/MF-0053 "exits 0 on this repo" tests run the real CLI in this worktree
and catch (a)–(c) here; SC-5 drives real git in temp repos for the skip and fail paths. No UI predicate, no DB write,
no versioned-content judgement in this ticket.

## Rejected options

- Edit `ticket-eval.mjs` to export `expandBraces` and a scope check there — not in the approved file list; rule 1 reuses
  `validatePlan` per task instead, and the 10-line brace expansion is restated (follow-up: export it, one owner).
- A representative-path check (replace `*`/`**` by `x`, as the retro suggested) — passes service-builder
  `src/features/**/actions.ts` (representative `src/features/x/actions.ts` is inside) though `src/features/a/b/actions.ts`
  is not; exact inclusion is cheap at these sizes.
- Exempt `.claude/skills/**` for retros — too wide (this ticket edits templates.md as its own work); RETRO `## Applied`
  names the files exactly.
- `MF_CHANGED_FILES` env override — the CLI tests would not exercise git.

## Verify

- VERIFY (no `ticket:verify` script): typecheck, gates (`gate:planning`, `gate:workspace`, `check-hooks`), lint, test;
  receipt line with `git diff HEAD | shasum -a 256` + untracked in LOOP-VERIFY.md.
- EVAL by hand: graph acyclic, every SC closed, review hash = tree (the orchestrator dispatches the reviewer, U-2).
- browser: none (no screen).

## Tasks — the graph the orchestrator dispatches; exactly one block

```json tasks
[
  { "id": "T1", "title": "rule 1 + rule 2 pure checks and inner tests", "agent": "orchestrator",
    "owns": ["scripts/lib/planning-check.mjs", "src/test/__tests__/planning-check-owns.test.ts"],
    "depends_on": [], "closes": ["SC-1", "SC-2", "SC-3", "SC-4", "SC-6"],
    "done_when": ["pnpm exec vitest run --project unit src/test/__tests__/mf-0060-plan-owns.acceptance.test.ts src/test/__tests__/planning-check-owns.test.ts", "pnpm typecheck"],
    "context": ["skill:testing-strategy", "file:scripts/lib/ticket-eval.mjs", "file:.claude/hooks/lib/agent-scopes.mjs"] },
  { "id": "T2", "title": "CLI wiring with git", "agent": "orchestrator",
    "owns": ["scripts/check-planning.mjs"],
    "depends_on": ["T1"], "closes": ["SC-5"],
    "done_when": ["pnpm gate:planning", "pnpm exec vitest run --project unit src/test/__tests__/mf-0028-planning-check.acceptance.test.ts src/test/__tests__/mf-0053-design-preflight.acceptance.test.ts"],
    "context": [] },
  { "id": "T3", "title": "templates.md LOOP-PLAN shape", "agent": "orchestrator",
    "owns": [".claude/skills/gsd-goal-loop/references/templates.md"],
    "depends_on": ["T1"], "closes": ["SC-7"],
    "done_when": ["pnpm exec vitest run --project unit src/test/__tests__/mf-0060-plan-owns.acceptance.test.ts"],
    "context": [] },
  { "id": "T4", "title": "ladder, receipt, evidence", "agent": "orchestrator",
    "owns": [".planning/tasks/MF-0060/LOOP-VERIFY.md", ".planning/evidence/MF-0060.md"],
    "depends_on": ["T2", "T3"], "closes": ["SC-8"],
    "done_when": ["pnpm typecheck", "pnpm lint", "pnpm test", "pnpm gate:planning", "pnpm gate:workspace", "node scripts/check-hooks.mjs"],
    "context": [] }
]
```
