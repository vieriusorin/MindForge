---
phase: 0-verification
ticket_id: MF-0060
status: complete
verdict: PASS
started_at: "2026-11-06"
completed_at: "2026-11-07"
resume_with: /gsd-goal-loop
---

# Verification — Iteration 0

## RED at freeze (Stage 2b)

| SC | Acceptance test | Red reason at freeze (pasted) |
|----|-----------------|-------------------------------|
| SC-1..SC-4, SC-6 | `mf-0060-plan-owns.acceptance.test.ts` | `Error: not implemented` (typed stubs in planning-check.mjs, CLI not wired) |
| SC-5 | same | `expected 'gate:planning: 1 ticket folders check…' to contain 'gate:planning: rule 2 skipped: no mai…'`; `… to contain 'MF-0061: src/x.ts is changed but in n…'` (owned case green: exit 0 already) |
| SC-7 | same | `expected '# Templates\n\nShapes for every artif…' to contain '`checkPlanOwns`'` |

Full `pnpm test` at freeze: only this file red (17 failed, 1086 passed). Proof-case replay before freeze: RED (probe).

RED-first during BUILD: `planning-check-owns.test.ts` "a nested brace set is reported once by the syntax rule" —
`AssertionError: expected [ …(5) ] to deeply equal [ Array(1) ]` (expandOwns expanded nested sets innermost-first and
added 4 scope lines); fixed by refusing depth > 1 before expanding, then green.

Review round 1 (APPROVE-WITH-FIXES, reviewed_hash 95f1ace87a96) fixes:
- Finding 1 RED first: `planning-check-owns.test.ts` "a grandfathered folder in the set (a re-freeze) lends its
  exemptions but not its owns (MF-0060 review 1)" against the unfixed code —
  `AssertionError: expected [] to deeply equal [ Array(1) ]` (MF-0058's plan owned `walk-session.test.tsx`, so the
  MF-0067 hand-off flagged nothing). Fixed: ownership union only from folders after OWNS_CUTOFF; FROZEN/RETRO
  exemptions still from every folder in the set. Then green.
- Finding 2: two inner CLI tests on the CI ref shape (detached merge of main C + feature B, only
  `refs/remotes/origin/main` = C, no local branch; main's `src/other.ts` never judged; the PR's unowned `src/x.ts`
  flagged, exit 1). Green on the current code (a regression lock, no behaviour change).
- Nits 7, 8 (templates.md: agent line, `## Applied` exactness, re-freeze rule) and 9 (`HANDOFF`, `PAST_DESIGN` reused).
  Findings 3, 10, 11 left (orchestrator).

| SC | Verdict | Evidence |
|----|---------|----------|
| SC-1 | PASS | acceptance SC-1 4/4; inner brute-force cross-check (98 glob x scope pairs) agrees |
| SC-2 | PASS | acceptance SC-2 2/2 |
| SC-3 | PASS | acceptance SC-3 3/3 |
| SC-4 | PASS | acceptance SC-4 3/3; inner record edges 4/4 |
| SC-5 | PASS | acceptance SC-5 3/3 (temp repos: `trunk` → skip line, exit 0, stderr ""; `main` + unowned → exit 1; owned → exit 0) |
| SC-6 | PASS | acceptance SC-6 2/2 (11 lines incl. T4 schemas/types; rule 2 = the 3 files) |
| SC-7 | PASS | acceptance SC-7 1/1 |
| SC-8 | PASS | commands below; `pnpm gate:planning` printed no skip line in this worktree |

## Gates and suite

`pnpm typecheck` exit 0 · `pnpm lint` exit 0 ("Checked 766 files … No fixes applied", 0 warnings) · `pnpm test` exit 0
("Test Files 197 passed (197)", "Tests 1116 passed (1116)") · `pnpm gate:planning` exit 0 ("69 ticket folders checked,
ok") · `pnpm gate:workspace` exit 0 ("4 allowBuilds entries, ok") · `node scripts/check-hooks.mjs` "check-hooks: PASS".
Self-check: rule 1 and rule 2 run over MF-0060's own plan and diff (cutoff bypassed) → 0 lines.

## Receipt (no ticket:verify script)

`2026-11-07T09:40:28Z · tree 95f1ace87a96 (sha256 of git diff HEAD + untracked, excluding .planning/**) · typecheck 0 · gates 3/3 · lint 0 · test 1113/1113 · PASS`
`2026-11-07T09:51:42Z · tree 91d7005d5185 (full 91d7005d5185d0403c13d72b1fdb9c55d4e1e912cb50b52555d394394c3f977d, same definition as REVIEW.md) · typecheck 0 · gates 3/3 · lint 0 · test 1116/1116 · PASS`

## Not verified

- A real CI run of the PR: the merge-ref shape is now covered by an inner test (review 2), not by GitHub Actions itself.
- Post-review delta (finding 1 fix, tests, nits) awaits the orchestrator's delta re-review.
- Fresh-context diff review: the orchestrator dispatches it (U-2).
- `pnpm test:db`, `pnpm build`, browser: not applicable (no DB, no screen).

## Verdict: PASS
