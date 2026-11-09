---
ticket_id: MF-0069
title: "Plan lint: a plan that adds or changes a parser must carry an accepted grammar and a rejected-inputs table"
tier: high-risk                   # a gate script
stage: handoff
branch: feat/MF-0069
builds_on: [MF-0048, MF-0060]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Reserved 2026-11-06 from MF-0048 RETRO (action 1, gate). Third occurrence of lesson `gate-parser-fail-closed`
> (MF-0043, MF-0046, MF-0048). Claimed 2026-11-09.

## Objective

**Today.** `verification.md` §4 says gate parsers fail closed by an allowlist and that exemptions skip only their own
rule, and the LOOP-PLAN template has a `## Parsers` section (MF-0048 retro). Both are prose. MF-0048 still shipped
its secondary `owns` parser as a blocklist with the main-session exemption before the syntax check (review B1, B2).

**End state.** `pnpm gate:planning`, which already runs in CI and the Stop gate, refuses a plan that touches parser
territory without declaring its parsers. Every such plan has a `## Parsers` section. It either says `None: <reason>`
or holds one `### <name>` block per parser, and each block carries an accepted grammar, a rejected-inputs table of at
least 3 rows, and an exempt-path test.

## Facts (re-derived 2026-11-09 at pickup)

- **Q-1's premise is settled.** MF-0060 is on `main`. `gate:planning` already runs `validatePlan` through
  `checkPlanOwns` (`scripts/lib/planning-check.mjs:371`, `:404`). Every gate:planning rule is a pure
  `check*(entries)` in that file, scoped to tickets after a cutoff (`PREFLIGHT_CUTOFF` MF-0052, `SEE_IT_CUTOFF`
  MF-0054, `OWNS_CUTOFF` MF-0060).
- **Proof case.** The MF-0048 LOOP-PLAN on `main` (`dc4e9b2`, unchanged since `8a198e8`) has no `## Parsers`
  section. Its tasks own `.claude/hooks/lib/agent-scopes.mjs` and `scripts/lib/ticket-eval.mjs`.
- **The drafted text trigger is too broad.** `/pars(e|er)|check-|gate|exempt|allowlist|grandfather/i` on the plan
  text plus owned files under `scripts/`, `.claude/hooks/` or `src/engine/` fires on **45 of 54** shipped plans
  (read-only probe, scratchpad `probe69.mjs`), e.g. MF-0011's heatmap engine. A path-only trigger fires on 16, with
  test-file false hits (`mf-0065-check-misconceptions…`), and misses the MF-0048 proof case.
- **Only 3 shipped plans have a `## Parsers` section** (MF-0049, MF-0060, MF-0061), each free-form. MF-0049 uses the
  three labels and a 7-row table. MF-0060 writes "Grammar:" and points at the GOAL for rejected inputs. MF-0061 uses
  none of the labels. Every shipped plan is before the cutoff, so none of them is judged.
- No ticket after MF-0068 is past `intake` on any branch (2026-11-09), so the cutoff reddens nothing today.

## Success Criteria

- [x] **SC-1: a plan in parser territory without a `## Parsers` section fails.** `checkPlanParsers(entries)` in
  `scripts/lib/planning-check.mjs` returns one line, `<dir>: LOOP-PLAN owns <glob> but has no "## Parsers" section
  (write "None: <reason>" or one ### block per parser)`, for a governed ticket whose `owns` include a non-test glob
  under `scripts/`, `.claude/hooks/` or `src/engine/`. Proof: `src/test/__tests__/mf-0069-plan-parsers.acceptance.test.ts`
  SC-1. The MF-0048 LOOP-PLAN read from the repo, placed under dir `MF-9999` at stage `build`, gives exactly that
  line with `<glob>` = `.claude/hooks/lib/agent-scopes.mjs`.
- [x] **SC-2: `None: <reason>` is the declared no-parser answer.** A section whose first non-blank line is
  `None: ` followed by at least one word, and which has no `###` block, passes. A bare `None:` is a problem. So is a
  section that holds neither `None:` nor a block. Proof: acceptance SC-2.
- [x] **SC-3: each `### <name>` block is complete.** A block needs a line with `Accepted grammar:` followed by text
  on the same line, a `Rejected inputs` line followed by a Markdown table with at least 3 data rows, and an
  `Exempt-path test:` line followed by text (`none: <reason>` is fine). Each missing part is its own line naming the
  block, e.g. `<dir>: Parsers block "<name>" has no Rejected inputs table with 3 or more rows`. A second, broken block
  fails even when the first is complete. Proof: acceptance SC-3.
- [x] **SC-4: scope.** Nothing is reported for any of these:
  - a ticket at or before MF-0068;
  - a `reserved` ticket;
  - a ticket at `intake`, `design` or `plan`;
  - no LOOP-PLAN.md, or a task block that does not parse (`checkPlanOwns` already reports both from `build` on);
  - owns that are only `__tests__/` paths or lie outside the three trees.
  CRLF plans are read like LF plans. Proof: acceptance SC-4.
- [x] **SC-5: wired into gate:planning, and the repo passes.** `node scripts/check-planning.mjs` with `MF_TASKS_DIR`
  set to a fixture holding the SC-1 proof case exits 1 and prints the SC-1 line. On this repo,
  `node scripts/check-planning.mjs` exits 0. Proof: acceptance SC-5, plus `pnpm gate:planning` in LOOP-VERIFY.
- [x] **SC-6: the template matches the rule.** The `## Parsers` example in
  `.claude/skills/gsd-goal-loop/references/templates.md` shows `None: <reason>` and the `### <name>` block shape,
  and its block example, run through `checkPlanParsers` as a governed plan, gives no problems. Proof: acceptance
  SC-6 reads the example between the `<!-- parsers-example -->` markers.

## Constraints → how met

- The gate must not redden `main` or another contributor's in-flight ticket. The cutoff is MF-0068, and no
  later ticket is past `intake` (Facts). The rule only judges from `build` on, so a planner drafting at `plan` is
  not blocked.
- A gate parser fails closed (verification.md §4). Anything that is not `None: <reason>` or complete `###` blocks is
  a problem naming the input, and the shape checks run per block before anything is skipped (LOOP-PLAN Parsers).
- One owner per fact: `frontValue`, `expandOwns` (planning-check.mjs) and MF-0048's `parsePlanTasks` /
  `globsOverlap` are reused. The section reader is new, because `sectionBody` is not fence-aware and a fenced
  `### ` or `## ` line must not count (review note).

## Out of Scope

- Judging whether a declared grammar is correct, or whether the rejected inputs are tested. The rule checks the
  plan declares them. The fresh-context review checks the substance.
- Retrofitting shipped plans (all before the cutoff).
- A separate `ticket:plan-lint` CLI (user, 2026-11-09).

## Decided by the user

- 2026-11-09, trigger: "Declare it, like Symbols changed". Plans owning non-test files under `scripts/`,
  `.claude/hooks/` or `src/engine/` need a `## Parsers` section, which may be `None: <reason>`.
- 2026-11-09, shape: "gate:planning, ### blocks". A new `checkPlanParsers` in `planning-check.mjs`, run by
  `gate:planning`, judges each `### <name>` block for the three labels plus a table of 3 or more rows. The template is
  updated to match.
- No proof command wipes local state (no `db:reset` / `supabase stop`).

## Decided without a question

- Cutoff `MF-0068`, so this ticket's own plan is the rule's first governed plan (dogfood). Precedent: each
  gate:planning rule governs tickets picked up after it.
- Judged from `build` on, as `checkPlanOwns` does (`plan` is drafting).
- `src/engine/**` is in the trigger although it holds no gates: the MF-0048 lesson names "pure core in scripts/lib or
  src/engine" parsers (pack loaders, question schemas). `None: <reason>` keeps the cost for a non-parser engine
  change to one line.
- Test-only owns (`__tests__/`) do not trigger. Acceptance-test-only tickets (e.g. MF-0067) add no parser.

## Concerns

- None open. Accepted residuals (review round 2, non-blocking): an unclosed fence inside the section hides later
  `###` blocks; a line opening with inline code (```` ```x``` ````) reads as a fence; after `Rejected inputs: see GOAL`, a
  table under a non-block label (`Notes:`) still counts; `stage:` outside the closed set skips the rule (as
  `checkPlanOwns`). Candidates for the next gate:planning ticket (MF-0070 is its follow-up bucket).

## Iteration Log

- 2026-11-09 picked up; facts re-derived (above); user decided trigger and shape.
- 2026-11-09 design preflight: `pnpm gate:planning` 0 (71 folders) · `pnpm typecheck` 0 · `pnpm lint` 0 · `pnpm test` 1 failed | 1479 passed (baseline, Windows-only `mf-0065-check-misconceptions` SC-8) · `node scripts/check-hooks.mjs` 0 · main CI `6efdf88` success · `pnpm test:db` not run: no SC names it.
- 2026-11-09 proof-case replay: RED. The MF-0048 LOOP-PLAN owns `.claude/hooks/lib/agent-scopes.mjs` and has no
  `## Parsers` section, so the drafted rule (owns trigger + missing section) reports it (probe69 + section grep).
- 2026-11-09 review round 1: changes-requested, B-1 (substring/fenced labels, table under another label) and B-2
  (prefix-only trigger, fail open). 12 regression cases shown RED (12 failed | 12 passed), fixed; frozen file unchanged.
- 2026-11-09 review round 2: approve, tree `51c23327…`. Hand-off.
