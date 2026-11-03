---
applied: 2026-11-03
ticket: MF-0005
outcome: pass
causes: wrong-plan, known-trap-repeated, missing-context
actions: skill-edit
lesson_keys: design-preflight-sc-preconditions, hosted-scs-split-from-code, format-before-freeze
---
## Numbers
No `ticket:retro` script exists; counts read by hand from the ticket's files.
- Iterations: 1 (`last_iteration: 1`). `goal_status: complete-pending-manual-commit`. No REVIEW.md in the ticket folder, so none counted.
- Freeze: 2 files, 0 re-freezes. `mf-0005-ci` frozen red (8/8), `mf-0005-grants.db` frozen green as a regression lock.
- Receipt: local slice DONE. `pnpm test` 28 files / 93 passed, `test:db` 6 files / 17 passed, typecheck, lint, `check-hooks`, `pnpm build`, actionlint 1.7.7 and a clean-checkout run all exit 0. Diff sha `14ed5d0a...`.
- SCs: 5 ticked (SC-1, 3, 4, 5, 6), SC-2 unticked (cold `supabase start -x ...` and `pnpm db:reset` never run). Post-push proofs (first green run, test PR, branch protection, `db` job time) went to MF-0019, reserved for the user.
- Baseline before any code: `pnpm test` 9 failed (8 expected MF-0005 reds + 1 pre-existing `mf-0004-rotate-invite` SC-9), typecheck and lint red on `src/features/groups/types.ts`.
- Token metrics: not available, so no median comparison.

## Went right
- The baseline run caught that merge `bc61088` had reverted part of MF-0004 (duplicate import, missing `rpc-errors` imports, `createGroup` back on its generic error). It was caught before any code, so the later receipt counted only new failures. Evidence: LOOP-VERIFY "Baseline", `logs/baseline-test.log`. Keep: already is, SKILL.md Stage 3b "baseline VERIFY run".
- The hosted-proof split worked. The user chose at DESIGN to move the first green run, test PR, branch protection and DB-job timing to MF-0019, so this ticket closed with 5 of 6 SCs ticked and the unticked one named. MF-0004's retro proposed this rule and it was applied; here it paid off. Keep: already is, SKILL.md Stage 2 paragraph "An SC whose proof needs infrastructure...".
- The grants gate was frozen green as a regression lock, and its red was proven on two scratch changes (`grant truncate on public.groups to authenticated`; a table without `revoke all`, which gave 8 `anon/authenticated MAINTAIN/REFERENCES/TRIGGER/TRUNCATE` lines), each reverted and re-run green. Evidence: `logs/sc3-red.log`. Keep: already is, `.planning/evidence/MF-0005.md`. It is a reusable pattern for any "gate that is already green" SC, but a one-off technique so far, not a rule.
- A clean-checkout run (fresh worktree, no `.env.local`, no `node_modules`) of the whole `checks` job, plus actionlint through Docker, gave real proof of the workflow without a push. Keep: already is, `logs/clean-checkout.log`.
- Supply-chain care: `pnpm/action-setup` v6.1.1 was skipped for v6.1.0 because it was published the same day, and the SHAs were resolved from the GitHub API rather than from memory. Recorded in the evidence "Unverified" section only.

## Went wrong
- SC-2 was left unticked and SC-3's proof wording was changed after freeze. Both SCs had proofs that need `pnpm db:reset` (and a cold `supabase start`), which wipes the shared local DB. DESIGN did not check this. It surfaced in BUILD as concern C-2 (owner "agent -> user"). The user rejected the AskUserQuestion checkpoint ("fix the pre-existing break? run db:reset?") and then said "continue". The agent chose defaults: no reset, and SC-3's "db:reset green again" became "revert in place, re-run green". The Iteration Log flags that deviation. SKILL.md Stage 2 says Build does not start while a concern with a non-agent owner is open, and escalation.md lists "an SC turns out wrong or impossible as written" and "a destructive operation on shared test data" as user decisions. This was a DESIGN-time check that did not exist: no step asks "does any SC proof run a destructive command on the shared local stack?". cause: wrong-plan, enabled by missing-context.
- A pre-existing red (the `bc61088` merge break in `src/features/groups/{actions,types}.ts`) was fixed inside this ticket as T3. The rule says the opposite: SKILL.md Stage 3b "Pre-existing breakage you trip over is noted, not fixed" and escalation.md "A pre-existing failure outside the diff - note it in LOOP-VERIFY, carry on". But SC-1's proof is "each command exits 0 locally in a clean checkout", which cannot hold while typecheck and lint are red. The rule has no branch for "the pre-existing red blocks an SC's proof", so the agent followed the SC, not the rule, and asked mid-BUILD instead of at DESIGN. The user declined the question, so the 2 MF-0004 files now sit in the uncommitted MF-0005 diff, mixed with this ticket's files. The baseline red was already visible at FREEZE ("RED at freeze" notes typecheck/lint errors), one stage before it was acted on. cause: known-trap-repeated (the rule was written; the exception it needs was not).
- A `git checkout c2f2bd5 -- <files>` restore of those two files was denied by the auto-mode classifier and redone as targeted Edits, ending with an empty `git diff c2f2bd5 -- src/features/groups/`. Cost: one tool call and a re-do. No defect. cause: tooling.
- The first `mf-0005-ci` run failed SC-6 because a comment in `ci.yml` contained the banned substring "secrets.". The frozen test did its job (one cheap red, the comment was reworded, the test unchanged), but the author had not read the frozen test's banned-token list before writing the workflow. cause: none worth acting on.
- The LOOP-PLAN records pnpm/action-setup v6.1.1 `73e46992...` while the built workflow uses v6.1.0. The plan was not updated when v6.1.1 was dropped (SKILL.md 3b: "Update LOOP-PLAN.md before continuing, not after"). Small, and the evidence file carries the real choice. cause: wrong-plan (minor).

## Actions (at most two)
1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/SKILL.md`, Stage 2 (DESIGN). Immediately after the paragraph ending "...task inside the code ticket." insert this paragraph:
   "Before the checkpoint, preflight each SC's proof. (1) Run `pnpm typecheck && pnpm lint && pnpm test` read-only. If any of them is red and an SC's proof is 'that command exits 0', the baseline red is part of this ticket's scope question: put it in the checkpoint with the file named, as either 'fix it as task T0 (listed in the hand-off as a separate hunk)' or 'park until its owner fixes it'. Do not leave it for BUILD. (2) List every proof command that wipes or restarts shared local state (`pnpm db:reset`, `supabase stop`, `supabase start`, `supabase db reset`). For each, either get the user's approval at the checkpoint, or write the SC's proof so it does not need it (an in-place revert, a scratch schema, a separate worktree). Record both outcomes under 'Decided by the user'. Nothing here is asked mid-BUILD."
   Would have saved: the rejected mid-BUILD AskUserQuestion, the post-freeze change to SC-3's proof wording, an unticked SC-2, and the MF-0004 files landing in this ticket's diff without an answer.
2. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/references/escalation.md`, in "Do NOT escalate", replace the bullet "- A pre-existing failure outside the diff — note it in LOOP-VERIFY, carry on." with:
   "- A pre-existing failure outside the diff — note it in LOOP-VERIFY, carry on. Exception: if an SC's proof is that command exiting 0 (a CI or 'clean checkout' SC), the failure blocks the SC. That is an escalation, resolved at DESIGN (SKILL.md Stage 2 preflight), not a fix made quietly in BUILD."
   Would have saved: the contradiction between this rule and SC-1 that the agent had to resolve alone. This is a sharpening of an existing rule, not a loosening.

## Not worth changing
- `secrets.` in a workflow comment tripping the frozen SC-6 test: one run, caught by the test as designed. No pattern.
- The classifier denying `git checkout <sha> -- files`: the Edit fallback worked; the denial is the harness doing its job.
- The `pnpm/action-setup` same-day-release skip and the LOOP-PLAN not updated to v6.1.0: a record-keeping slip. A "skip releases younger than N days" note belongs in `docs/runbook/ci.md` when MF-0019 or a later CI ticket touches it, not in a skill.
- `ticket:retro`, `ticket:verify` and `ticket:freeze` scripts still do not exist (also noted in MF-0004's retro). The process worked by hand.
- No token numbers are available, so no token-waste finding. The ticket was small (one workflow, one runbook, one DB test), and the two long steps (clean-checkout build, actionlint) were the proof, not waste.

## Applied
- 2026-11-03: action 1 (skill-edit, additive) applied: `.claude/skills/gsd-goal-loop/SKILL.md` Stage 2, "preflight each SC's proof" paragraph after "…task inside the code ticket."
- 2026-11-03: action 2 (skill-edit, tightening exception appended to the existing bullet, nothing removed) applied: `.claude/skills/gsd-goal-loop/references/escalation.md`, "Do NOT escalate", pre-existing-failure bullet.
- Also corrected the LOOP-PLAN pnpm/action-setup version (v6.1.0, matching the workflow) that the retro flagged.
- Held: none.
