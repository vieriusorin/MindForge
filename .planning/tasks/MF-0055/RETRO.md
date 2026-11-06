---
ticket: MF-0055
outcome: pass
causes: wrong-plan, missing-context, known-trap-repeated
actions: skill-edit, gate
lesson_keys: tier-misread-dev-tooling, handoff-records-unchecked, sc-proof-claim-unverified
applied: 2026-11-06
---
## Numbers

No `ticket:retro` script exists; counts come from the artifacts.
- Iterations: 1 (PASS). Frozen RED: none. FROZEN.json: none. LOOP-PLAN: none. REVIEW: none. Tier: `normal`.
- Records the building session left: GOAL.md and `.planning/evidence/MF-0055.md`. LOOP-VERIFY.md and RETRO.md were written at close-out by the MF-0054 session.
- Tests: `mf-0055-ticket-github.test.ts` holds 22 tests; the evidence says 25/25 (LOOP-VERIFY: "that count was wrong").
- Suite on the combined tree: typecheck 0, lint 0, test 764/764, `gate:planning` 0 (54 folders).
- Size: `scripts/ticket-github.mjs` is 543 lines and `scripts/lib/ticket-github.mjs` is 279. Neither had a fresh-context review.
- Live effects outside the repo: issue #85 created, 54 tickets synced, and the project Status options replaced. That cleared every card's Status until `--all` restored it.

## Went right

- The logic was kept pure and testable. `syncPlan`, `claimDecision`, `parseGoal`, `nextTicketId` and `checkSeeItYourself` all sit in `scripts/lib/ticket-github.mjs` and `scripts/lib/planning-check.mjs`. SC-1 to SC-5 have unit proofs, and the live runs on #85 and `next` back SC-3 and SC-4. The preflight line is present. — keep: already is, in the `functional core, imperative shell` rule in `engineering-principles.md`.
- The building session found its own side effect. It saw that `--all` moved MF-0054 back to Todo, fixed `syncPlan` for it, and added a test. That is the right response to an outward-facing writer. — keep: the retro rule `rerunnable-writer-surviving-state` already covers it.
- The close-out was honest. LOOP-VERIFY states "Not done" for RED, corrects the 25/25 count, and lists what was not verified. The `ci.yml` conflict was resolved to `main`. — keep: already is, in LOOP-VERIFY.md.

## Went wrong

- **Wrong tier, so the loop ran without its safeguards.** GOAL.md says `tier: normal  # dev tooling: a script, a skill edit, a gate rule; no app code, no DB`. The ticket changes a gate (`scripts/check-planning.mjs`, `scripts/lib/planning-check.mjs`) and the gsd-goal-loop skill. It also writes to outward-facing state (a GitHub issue, 54 syncs, the project Status field) and publishes ticket text from a public repo. `gsd-goal-loop/SKILL.md` binds HIGH_RISK to "schema + migrations, authz / access policy, auth wiring, privileged DB clients, money". Dev tooling that gates or writes externally appears nowhere, so "no app code, no DB" read as normal. Under normal tier, Stage 2b RED, LOOP-PLAN, the fresh-context diff review and the hand-off records are not required, and none were produced (LOOP-VERIFY "Not done", "No fresh-context review of 822 lines"). Cause: wrong-plan, with missing-context (the tier definition has no clause for tooling).
- **No gate sees a missing hand-off record.** `pnpm gate:planning` passed MF-0055 with no LOOP-VERIFY.md and no FROZEN.json. `planning-check.mjs` only checks the GOAL's front matter (`checkPlanning`), the preflight line (`checkDesignPreflight`) and the evidence `## See it yourself` heading (`checkSeeItYourself`). Nothing reads the folder's file set. Cause: missing-context (only a static check can enforce this, hence the gate action below).
- **The SC-proof count was hand-typed and wrong** (25/25 vs 22). The memory entry `feedback-verify-derived-facts` already says to confirm a named proof covers the SC. Cause: known-trap-repeated. It is minor here (a count, not a verdict), so no action beyond the gate: a receipt generated from the runner would not have this field.
- **Changes to other tickets' records were not recorded.** MF-0001, MF-0010, MF-0018 and MF-0020 were edited to scrub other projects' names, and GOAL.md has no line for it until close-out added "Also in the diff". Cause: missing-context. The edit is sensible and was found at close-out, so this is a one-off.
- **Duplicate `ci.yml` hunk and a branch two commits behind `main`.** MF-0055 added the same `fetch-depth: 0` as MF-0054 and conflicted on merge. Cause: parallel sessions. This is covered by the `parallel-session-coordination` lesson already in the retros, so it is not a new action.

## Actions (at most two)

1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/SKILL.md`, line 42 (the `HIGH_RISK` binding row) and line 147 (Stage 1 "Set `tier:`"). Both edits add a rule.
   - Line 42: replace the third cell with
     `schema + migrations, authz / access policy, auth wiring, privileged DB clients, money and other derived figures, **gate scripts** (scripts/check-*.mjs, scripts/lib/*-check.mjs), hooks and settings, and any script that writes to an external service (GitHub issues/projects, hosted DB)`
   - Line 147: after "HIGH_RISK binding," insert
     `which includes tooling that gates or publishes: a gate, a hook, or a script with an outward side effect is high-risk even with no app code and no DB ("dev tooling" is not a reason for normal),`
   Would have saved: the missing Stage 2b RED (the tests were never shown failing first), the LOOP-PLAN, the fresh-context review of 822 script lines, and the hand-off records the MF-0054 session had to rebuild at close-out (roughly one session of rework). It would also have put the GitHub-state side effect (the Status-option wipe) into a riskiest-step section before the live run.
2. gate: draft a new ticket; do not build it in the retro. Claim the number with `pnpm ticket:github next` (MF-0056 was the next free number at close-out; the 7-day-old retro rule says re-check at claim). GOAL.md needs `title: gate:planning rejects a hand-off ticket with no LOOP-VERIFY.md / FROZEN.json`, `goal_status: reserved` and the origin line `> Reserved 2026-11-06 by the MF-0055 retro`. Then run `pnpm ticket:github <NEW-ID>`. Target: `scripts/lib/planning-check.mjs`, a new check beside `checkSeeItYourself`, wired in `scripts/check-planning.mjs`.
   - Pattern: a folder whose GOAL.md has `goal_status: complete-pending-manual-commit`, `tier:` normal or high-risk, a ticket id above a cutoff of MF-0055 (so history passes, as `PREFLIGHT_CUTOFF` and `SEE_IT_CUTOFF` do), and **no** `LOOP-VERIFY.md` in its folder. For high-risk, also require `FROZEN.json` and a REVIEW.md or recorded reviewer status.
   - Proof case it would have caught: MF-0055 at the moment the building session handed off. The folder held only GOAL.md, and `gate:planning` printed ok.
   - Yield: unmeasured. The pickup session must first run a read-only pass over the existing 54 folders and write down how many hand-off or complete tickets lack LOOP-VERIFY.md, because the cutoff may need to move. Check also that a normal-tier ticket legitimately may skip FROZEN.json (read `ticket-traceability` lines 41-43 first).
   Would have saved: the whole class "hand-off with no verify record". The building session would have been told by the gate, and the close-out session would not have had to reconstruct records afterwards.

## Not worth changing

- 25/25 vs 22 test count: a hand-typed number; the gate in action 2 covers its cause. No separate memory entry (`feedback-verify-derived-facts` already exists).
- Scrubbing other projects' names from four older tickets: sensible on a public repo and found at close-out. If it recurs, add a check for foreign project names in `.planning/**`. Once is not a pattern.
- Duplicate `ci.yml` hunk with MF-0054 and a stale branch: parallel-session overlap, already a known lesson (`parallel-session-coordination`).
- Stop hook not installed (the auto-mode classifier refused an edit to `.claude/settings.json`): a decision for the user, recorded in GOAL.md "Decided by the user". Not a process defect.
- Token usage: no metrics available, so no claim is made.

## Applied
- 2026-11-06 skill-edit (additive) applied: `.claude/skills/gsd-goal-loop/SKILL.md`, the `HIGH_RISK` binding row now lists gate scripts, hooks/settings and scripts that write to an external service; Stage 1 "Set `tier:`" says tooling that gates or publishes is high-risk.
- 2026-11-06 gate → reserved ticket MF-0056 (`.planning/tasks/MF-0056/GOAL.md`, `goal_status: reserved`), not built. Its GitHub issue is not created yet (`pnpm ticket:github MF-0056` held: it writes to GitHub; run it when MF-0055 is committed).
- Held: nothing else.
