---
ticket: MF-0024
outcome: pass
causes: known-trap-repeated
actions: gate, memory-update
lesson_keys: sc-proof-claim-unverified, frozen-shape-collision-grep-in-plan, design-preflight-sc-preconditions
applied: 2026-11-05
---
## Numbers
(No `pnpm ticket:retro` script exists; counts taken by hand from LOOP-VERIFY.md and GOAL.md.)
- Iterations: 1 (iteration 0). Blockers in review: 0. Should-fix: 2, both GOAL.md text, applied.
- RED at freeze: unit acceptance 6 failed / 2 green-by-design; DB acceptance SC-3 x2, SC-5 x2 failed (same on 2nd run).
- Receipt: typecheck 0, lint 0, `pnpm test` 129 files / 580 pass, `pnpm test:db` 81/88 (7 reds = baseline `mf-0013-storms`, 0 new).
- Re-freeze: 1 (MF-0017 DB fixture, one line, user-approved at the checkpoint, recorded in MF-0017 FROZEN history).
- Shipped content probe: 504 items, 0 prefix mismatches.

## Went right
- The intake probes ran before the checkpoint: 504 items checked, the rule applied in a scratch worktree (568/568 unit+ui), and the frozen MF-0017 fixture (`mf-0017-expedition.db.acceptance.test.ts:30,373`) identified as the one test a DB CHECK would break. The user got options A/B/C with the exact cost of B (one re-freeze) and chose B with no rework, and the iteration finished in one pass. — keep: already is (lesson keys `frozen-shape-collision-grep-in-plan`, `design-preflight-sc-preconditions`); nothing new to write.
- Preflight baseline recorded before BUILD (19 DB reds, cause = local stack missing migration `20261105100000_mf0017_expeditions`), so the 7 remaining storm reds were attributed to baseline in minutes rather than debated. — keep: already is in LOOP-VERIFY "Baseline (before BUILD)".
- Intake noticed `MF-0031/GOAL.md` held two tickets after a merge, split the plan-check gate to `MF-0048/GOAL.md`, and kept it as a separate hunk in the hand-off. — keep: one-off, no change needed.
- The DB acceptance test seeds and removes its own fixture slugs and re-uses the MF-0012 temp-copy-of-`packs/` + `MINDFORGE_PACKS_DIR` shape, so no `db:reset` was needed. — keep: already is in MF-0012 RETRO.

## Went wrong
- GOAL.md SC-3 (and SC-5 by "same file as SC-3") named the proof file `mf-0024-sync-prefix.db.acceptance.test.ts`. The frozen file is `mf-0024-id-prefix.db.acceptance.test.ts` (as in LOOP-PLAN and FROZEN.json). REVIEW.md should-fix #1: the SC-to-proof trace pointed at nothing. A `ls` of every backticked `Proof:` path would have caught it. cause: known-trap-repeated (`feedback-verify-derived-facts`: confirm a record says what happened; the proof path is a derived fact that was typed from memory at draft time and never re-checked after the file was named at freeze).
- GOAL.md Objective and SC-4 claimed `pnpm check:packs` enforces the id rule. `scripts/check-pack-grounding.mjs` never calls `validatePacks`/`parseContent`, and exits 0 without checking when `.cache/corpus` is missing. REVIEW.md should-fix #2. The same wording was in the draft the user approved at the checkpoint, so the user chose B on a slightly wrong picture of where the rule is enforced (intent still met by the SC-4 lock under `pnpm test`). A one-line `grep -n validatePacks scripts/check-pack-grounding.mjs` during the probe would have shown it. cause: known-trap-repeated (same trap: a claim about what a command covers was written, not derived).
- Reviewer caught both only in the fresh-context review, after FREEZE, so the SC text was edited post-freeze (allowed because it was text, not intent, but it is the kind of edit the freeze exists to prevent).

## Actions (at most two)
1. gate: new `scripts/check-goal-proofs.mjs`, wired as `pnpm check:goal-proofs <ID>` and called by the Stop hook / hand-off step in `gsd-goal-loop` `references/verification.md` before REVIEW. It reads `.planning/tasks/<ID>/GOAL.md`, takes every backticked token on a `Proof:` line (or in an SC bullet) that matches `[\w./-]+\.(test|acceptance\.test)\.tsx?` or starts with `src/`/`scripts/`/`supabase/`, and exits 1 listing any path that does not exist on disk (`.planning/tasks/<ID>/FROZEN.json` `files[].path` must also all appear in GOAL.md). It also flags a `pnpm <script>` named in a `Proof:` line when that script is not in `package.json`. Real case it would have caught: MF-0024 GOAL.md SC-3, `src/server/db/__tests__/mf-0024-sync-prefix.db.acceptance.test.ts` (does not exist). Would have saved: one review should-fix and a post-freeze GOAL.md edit; a reviewer pass cannot be relied on to read this.
2. memory-update: `~/.claude/projects/-Users-sorinvieriu-Projects-mind-forge/memory/feedback-verify-derived-facts.md` (and its index line in `MEMORY.md`) — append to **How to apply**: "A command named as proof of an SC (`pnpm check:packs`, `pnpm test:db`) is a derived fact too: before writing it, `grep` the script it runs for the function the SC is about (MF-0024: `check:packs` never calls `validatePacks`, so it proved nothing about the id rule). Name proof files by the path the freeze will use, and re-read the SC proof paths after FREEZE." Change the index line to: `re-count from source before SCs/frozen tests; confirm writes before recording them; confirm a named proof command/file actually covers the SC`. Would have saved: the second should-fix and the wrong picture the user approved at the checkpoint.

## Not worth changing
- The 7 `mf-0013-storms` reds (fixture takes first 3 ccdv-f D2 keys without filtering flagged/rejected items; hypothesis unverified): pre-existing baseline, belongs to an MF-0013 follow-up, not this ticket.
- Local stack missing migration `20261105100000_mf0017_expeditions`: fixed with `supabase migration up --local` at the checkpoint; a one-off from parallel branches, already covered by `hand-run-ticket-scripts` / preflight baseline.
- DB-test teardown running a full real sync on an unsynced local DB (REVIEW note): harmless under the serial project, matches the documented setup step.
- SQL CHECK accepts a dot-less id equal to the slug while `idPrefixIssue` refuses it (REVIEW note): zod patterns already require dots, no real writer can produce one.
- Hosted pre-check query lives only in the migration comment and LOOP-PLAN, not in `docs/runbook/deploy.md`: a runbook follow-up (docs is outside this ticket's `owns`), listed in the hand-off.
- MF-0031/GOAL.md holding two tickets after a merge: split done in-ticket (K-3); a merge accident, not a pattern yet.
- Token usage: not measured (no metrics script); the ticket was one iteration with inline T1-T3, so nothing stands out.

## Applied

- Action 1 (gate): reserved as **MF-0049** (`.planning/tasks/MF-0049/GOAL.md`, goal_status: reserved). Not built:
  gate scripts, `package.json` and hooks are guarded config.
- Action 2 (memory-update): applied to `feedback-verify-derived-facts.md` (How to apply) and its `MEMORY.md` index line.
