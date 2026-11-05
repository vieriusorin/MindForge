---
ticket: MF-0034
outcome: pass
causes: wrong-plan
actions: skill-edit, skill-edit
applied: 2026-11-04
lesson_keys: validate-before-destroy, rerunnable-writer-surviving-state, red-first-regression-test, review-fix-delta-reread
---
## Numbers
`pnpm ticket:retro` is not in package.json (neither is `ticket:verify`), so the facts come from the ticket's artifacts. There are no session token metrics, so no token verdict is possible.
- Tier high-risk, 8 SCs, 2 frozen files (SC-1..SC-5 red at freeze with "not implemented" stubs), 5 plan tasks, plan approved by the user, FROZEN.json `history: []` (no refreeze), `last_iteration: 0`.
- Receipt DONE on iteration 0 (diff hash `beb27b0d...`): typecheck 0, lint clean, `Tests 335 passed (335)`, `test:db 45 passed (45)` with MF-0029's frozen tests unchanged.
- Fresh-context review: approve, 0 blocking, 7 notes, bound to `4d9317f3...`. 5 notes fixed after the review (1 test-first), 1 recorded, 1 partly covered.
- Real `pnpm dev:seed` run: 2 groups x 6 members, 861 answers per pack, `/review/prod-prompting` 200 over HTTP. Browser drawing not checked.

## Went right
- The MF-0029 retro rule ("state that survives a re-run") was applied in DESIGN: the GOAL "Riskiest step" lists the manifest (a) and external decisions (b) and names SC-5 for both. SC-5 went green on the first build and the review found no blocking item. MF-0029 needed two review rounds for the same class. Keep: already is, SKILL.md Stage 3 (the re-runnable-writer paragraph). It earned its cost.
- Reviewer ran probes, not only a read: HEAD vs new planner `JSON.stringify` parity over 5 seeds on real ccdv-f files (backs SC-6), and a cross-pack rollback probe on a run-scoped domain. The second probe is what exposed note 1. Keep: already is, SKILL.md Stage 4 ("fresh-context reviewer"); no new text needed.
- Note 1 was fixed test-first: `mf-0034-regressions.db.test.ts` shown RED (`groups: +0` vs `groups: 1`, both cases) and then green, with the failing line pasted in LOOP-VERIFY. Keep: already is, SKILL.md Stage 4 (RED-first for reviewer bugs, with the `git stash -u` fix from MF-0029).
- The privileged-write design held: delete scope unchanged from HEAD (demo domain only, manifest id AND `youId`), `seedDemoWorld` kept as a one-line wrapper, and the frozen MF-0029 tests ran unchanged. Keep: already is, the "Constraints -> how met" template.

## Went wrong
- The plan wrote "one pack's failure rolls back every group" as the intended safety property, but the checks that can fail (pack registered, `content_hash` fresh, item accepted) ran inside the transaction, after the demo users and your seeded attempts were deleted (REVIEW note 1, `seed-demo-world.ts:92-128` vs `:135-201`). One stale pack left 5 group-less demo users and no demo world for any pack. MF-0029 had the same shape for one pack, and multi-pack widened it (ccdv-f's hashes going stale while MF-0016 edits cuckoo content would wipe prod-prompting's world too). Cause: wrong-plan. The existing re-run paragraph asks what state survives. It does not ask what order the checks run in relative to the first destructive step, and "all writes in one transaction" reads as complete when the deletes sit outside it. Nothing static can detect this (no gate: it is an ordering fact about run-time failure).
- The review was bound to `4d9317f3...`, and 5 notes were fixed afterwards. The note-1 fix adds a pre-delete check on the privileged path, and the reviewer did not re-read it. Evidence lists this honestly ("not re-read by a second reviewer"), and the receipt says DONE for the tree, but the review hash no longer equals the tree. EVAL's "review hash = current tree" was not met for the code that guards the deletes. Cause: wrong-plan (the skill has no rule for what a post-review fix on a delete path needs). The CLI-only notes 2-5 all refuse before any DB call, so their risk is low.
- The in-transaction cross-pack rollback has only the reviewer's scratch probe and no committed test (note 7). Cause: wrong-plan, minor. The riskiest-step section named it ("one pack's failure rolls back every group") but no SC owned it. The new action 1 covers it, since it requires a committed test for failure order.

## Actions (at most two)
1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/SKILL.md`, Stage 3, in the re-runnable-writer paragraph that begins "A plan for anything that writes or deletes and can be run twice". Append this sentence after "...both found only in review).":
   "(c) failure order: every check that can fail on its inputs (pack registered, content hash fresh, item accepted, config valid) runs for ALL inputs before the first delete or other destructive write, and again inside the transaction; a transaction does not protect deletes made before it opens. Name a committed test that makes the second input bad and asserts the first run's data is still there (MF-0034 retro: the multi-pack seed deleted the demo world, then one stale pack failed inside the transaction; the cross-pack rollback has no committed test)."
   Would have saved: the one blocking-class design miss (review note 1), its fix cycle and RED proof, and the unreviewed post-review change on the delete path.
2. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/SKILL.md`, Stage 4, in the paragraph "A bug the reviewer finds gets its regression test shown RED first...". Append after "...A test written after the fix and never seen red does not count.":
   "A fix made after a high-risk review that touches a delete, auth or privileged-client path is not covered by the review hash. Before DONE, re-run the reviewer on the delta only (`git diff <reviewed_hash tree>` or the changed hunks plus the RED regression) and update `reviewed_hash`. If it is not re-reviewed, write 'post-review change to <path> not re-read' in LOOP-VERIFY and the evidence's Not verified list (MF-0034: the pre-delete check was added after the review and never re-read). CLI-only or message-only fixes that refuse before any DB call may stay on the original review."
   Would have saved: nothing this ticket lost (no defect was found), but it closes the gap where the guard against deleting the demo world was never seen by a second reader. A delta review costs a few hundred lines of context, much less than a full re-review.

## Not worth changing
- Reviewer notes 2-5 (CLI: every pack loaded on a narrowed run, `--pack=x` and misspelled flags ignored, inaccurate skip message, folder name vs `pack.yaml` slug): all fixed with probes (`--pak`, `--pack nope`, `--seed x`), each refusing before a DB call. Specific to this CLI. Note 5 (folder name vs slug) is the only reusable one ("derive an id from the file's own declared slug, not its folder name") and is too narrow to carry a rule.
- Note 6 (`new Date()` in a frozen DB test, following MF-0029's pattern): the file is frozen, and the planner takes the clock as a parameter. Recorded only.
- Missing `ticket:retro` and `ticket:verify` scripts: the reviewer and this retro both hand-computed the hash and counts, and MF-0029 recorded the same gap. It is a gate-ticket candidate for the orchestrator, and it did not cause a defect here. Not proposed as one of the two actions.
- Browser drawing unchecked (shared browser held by another session): HTTP fallback per the existing memory entry `feedback-browser-verification.md`. Already covered.
- Shared worktree on `feat/MF-0016` (C-1): files were disjoint and no collision happened. Already covered by `parallel-session-coordination`.

## Applied
- Action 1 (skill-edit, additive): applied: `.claude/skills/gsd-goal-loop/SKILL.md` Stage 2 re-runnable-writer paragraph gains "(c) failure order".
- Action 2 (skill-edit, additive): applied: Stage 4 regression paragraph gains the post-review delta re-read rule.
- Nothing held.
