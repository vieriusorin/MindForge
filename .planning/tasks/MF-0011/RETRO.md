---
applied: 2026-11-04
ticket: MF-0011
outcome: pass
causes: missing-context
actions: skill-edit, memory-update
lesson_keys: aggregate-threshold-inference, edit-uncommitted-migration-in-place
---
## Numbers
(no `pnpm ticket:retro` script; taken from the task files)
- tier high-risk, iterations 2, `last_iteration: 2`, goal_status complete-pending-manual-commit
- freeze: 1 re-freeze (FROZEN.json history, 2026-11-04T10:07:56Z, reason C-3, user approved), 2 acceptance files
- receipts: 2 (receipt 1 PASS but stale/superseded, receipt 2 PASS on tree 3a9b867f...): typecheck 0, lint 0 (346), test 56 files / 213, test:db 9 files / 31, build 0, advisors clean
- review: fresh-context diff-reviewer ran twice, both PASS-WITH-NITS, 0 blocking findings; the iteration-1 review raised C-3 (privacy inference) and the user changed the gate
- concerns: C-1 resolved, C-2 resolved by the user at DESIGN (server-only secret key, ADR 0004), C-3 resolved by the user after review, residual accepted -> MF-0021
- tokens: not recoverable from the files (no session metrics); no signal fired

## Went right
- The privileged-read collision (C-2: a SECURITY DEFINER read callable by `authenticated` would hand members each other's raw attempts, versus the `.env.example` / MF-0004 SC-8 "no secret key in the app" rule) was found at DESIGN and put to the user with options, before any code. It cost one question and produced ADR 0004, a one-importer lock test (`secret-client-importers.test.ts`) and an SC-3 catalog check. A late discovery would have meant a migration rewrite. -- keep: already is: `gsd-goal-loop` SKILL.md Stage 2 ("Concerns" with an owner) and `references/escalation.md`.
- The re-freeze was clean. The fixture defect (a new other-pack attempt broke the own-rows assertion; LOOP-VERIFY "First re-freeze attempt also failed SC-3") surfaced when the file was run red before freezing, was fixed in the fixture, and FROZEN.json records the old and new hashes plus the user-approved reason. -- keep: already is: `gsd-goal-loop` RED stage ("run red twice, record first_failure"); the "identical on 2nd run" notes show it was followed.
- The review bug N1 (status word contradicting the shown rounded percent, 0.846 -> 85 % -> "holding") was fixed test-first: the old rule was probed in place, seen red, then restored (LOOP-VERIFY "Review fix N1"). -- keep: already is: `tdd` / testing.md "a bug fix starts with a failing test".
- No proof command wiped shared local state: the migration applied with `supabase migration up --local`, and this was decided and recorded under "Decided by the user" at DESIGN (preflight step 2). -- keep: already is: `gsd-goal-loop` SKILL.md Stage 2 preflight (2).

## Went wrong
- The iteration-1 plan passed every gate (frozen tests, typecheck, lint, test, test:db, grants gate, advisors) and still shipped a privacy leak by design. The gate was "at least 3 contributing members, the viewer included", and the card showed "N of 3 members have played". With exactly 3 contributors, the viewer knows their own forest and can subtract it to read the other two named members' trees (single-skill regions read 0/33/67/100 %), and the count says whether a named member has played. This contradicted the ticket's own objective ("no individual forest ... ever readable"). Only the fresh-context reviewer saw it (REVIEW iteration 1, GOAL C-3). It cost a user question, a changed SC-2, a re-freeze, a migration rewrite (`is_viewer`), a `{viewer, others}` fetch API, and copy changes: roughly half of iteration 2. cause: missing-context. DESIGN has no step that asks "what can the viewer subtract or deduce from the output, given what they already know about themselves and the member list?". The threshold was copied from the planning grill (D-4, Q5) as a bare number, and nothing in the skill makes a high-risk aggregate answer the inference question before SCs freeze.
- The accepted residual (REVIEW note, MF-0021): single-skill regions still let a viewer in a group of 5 or more infer how many members have played, because healthy share = k / (N x |S|). It is the same family as C-3, one level down: the second review found it only after the first fix. It is an instance of the same missing DESIGN question, not a separate cause. cause: missing-context.
- The migration was edited in place after being applied locally. This was right for an uncommitted local-only migration, since a second migration would have left a dead function shape in history. But the reviewer noted that any other local stack that already applied the iteration-1 version will not pick up the change from `migration up --local` (the version is already recorded), and the page will then throw on a zod parse of `is_viewer`. The in-place procedure (drop the functions, delete the history row, `migration up`) lived only in LOOP-PLAN's iteration-2 delta. cause: missing-context.
- Minor: LOOP-PLAN `owns` omitted `index.ts`, `error.tsx` and the MF-0004 GOAL (review N7), and GOAL SC-2 carries a duplicated "Proof:" line. Neither cost an iteration.

## Actions (at most two)
1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/SKILL.md`, Stage 2 DESIGN. Insert as a new paragraph immediately after the paragraph that ends "...let verdicts land on unread content)." and before "Decide what follows from existing decisions":
   > Any SC that shows a figure, rank or flag computed over other people's data (a group aggregate, a heatmap, a leaderboard, an "N of M" line) must state in GOAL.md "Constraints -> how met" what the viewer can deduce from the output: (a) the threshold counts contributors OTHER than the viewer, because the viewer already knows their own row and can subtract it; (b) no count of contributors is shown or encoded in a figure's granularity; check the smallest region or bucket (a single-skill region gives k / N steps) and the smallest group that passes the gate; (c) a "ready" state that implies who has contributed is itself a disclosure. Write one worked example with the minimum group size in the SC's proof. A high-risk plan that handles other people's data without this section is not ready for approval (MF-0011 retro: a threshold of 3 including the viewer passed every gate and was caught only by the fresh-context reviewer).
   Would have saved: one user question, the SC-2 re-freeze, the migration rewrite and the `{viewer, others}` API change (about half of iteration 2), and probably the MF-0021 residual.
2. memory-update: `/Users/sorinvieriu/.claude/projects/-Users-sorinvieriu-Projects-mind-forge/memory/project-supabase-migration-rules.md`. Append this as item 5 after item 4, and add "uncommitted migrations are edited in place" to the `description` line:
   > 5. An uncommitted, local-only migration is edited in place rather than stacked with a second one (MF-0011, the return type gained `is_viewer`). Re-apply it with `drop function ...` + `delete from supabase_migrations.schema_migrations where version = '<v>'` + `supabase migration up --local` (no `db reset`), then `pnpm db:types`. `migration up` skips a version that is already recorded, so another stack or worktree that applied the old file keeps the old shape. Tell parallel sessions to re-apply, and say so in the hand-off. Once the migration is committed or applied to hosted, add a new migration instead.
   Would have saved: the reviewer note and the manual re-apply recipe, which today sit only in a LOOP-PLAN that the next session will not read.

## Not worth changing
- Fixture defect at re-freeze (other-pack attempt broke the own-rows check): caught by running the frozen file red before freezing, which is the process working. No edit.
- Another session navigated the shared devtools tab once: already covered by memory `feedback-browser-verification` (pageId, isolatedContext). The SC-5 evidence shows an isolated context was used. Not a new lesson.
- The heatmap error replacing the whole page (REVIEW note on `error.tsx`): a product decision, accepted since the runbook documents the key. Not a pattern.
- N3 (no DB test for the SQL `rejected` path): deliberately deferred because the test would reject a real shared item mid-run, and the engine test covers it. Recorded in LOOP-PLAN and evidence "Not verified".
- LOOP-PLAN `owns` gaps (N7) and the duplicated SC-2 "Proof:" line: one-off, no iteration lost.
- Receipt 1 was stale after the re-freeze: expected and recorded as superseded, not a failure.
- Hand-run verification (no `ticket:verify` / `ticket:freeze` scripts): already a known gap, noted in LOOP-VERIFY and covered by the `hand-run-ticket-scripts` lesson from MF-0003.
- Token usage: no session metrics in the files, so no claim. The ticket was large (migration, engine, server, UI, ADR, two reviews).

## Applied

- 2026-11-04 skill-edit (additive) applied: `.claude/skills/gsd-goal-loop/SKILL.md` Stage 2 gained a paragraph: an aggregate over other people's data must state what the viewer can deduce (others-only threshold, no count in a figure's granularity, a worked example at the minimum group size).
- 2026-11-04 memory-update applied: `project-supabase-migration-rules.md` item 5 (edit an uncommitted migration in place, the re-apply recipe, tell parallel sessions); description updated.
- Held: nothing.
