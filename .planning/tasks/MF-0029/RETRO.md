---
ticket: MF-0029
outcome: pass
causes: wrong-plan, tooling
actions: skill-edit, skill-edit
lesson_keys: rerunnable-writer-surviving-state, mocked-tests-miss-real-input, red-first-regression-test
applied: 2026-11-04
---
## Numbers
No `pnpm ticket:retro` script exists; facts come from GOAL.md, LOOP-PLAN.md, LOOP-VERIFY.md, REVIEW.md, FROZEN.json, evidence and the orchestrator.
- Tier high-risk, 7 SCs, 2 frozen files (3 unit + 4 DB tests red at freeze, 0 leftovers), 3 plan tasks, plan approved by the user, 0 SC changes after confirmation.
- Receipt DONE on iteration 1 (hash `b8a46db4...`), then fresh-context review round 1 changes-requested (2 blocking), round 2 approve (hash `cf2457fe...`). Gate 268/268 -> 270/270 and db 36/36 -> 38/38.
- 3 plan divergences recorded in BUILD (whole-day FSRS retune, "you" limited to 20 skills, flag only on AI-written items).
- Token usage: no metrics available. The ticket was large (CLI, planner, writer, two DB suites, browser check), so no token-waste signal is claimed.

## Went right
- Plan named the deletes as the riskiest step and guarded them (exact domain suffix, ids recorded AND owned by you). SC-6 (outsider byte-identical) held, and no delete ever reached a non-demo user. Keep: already is, in `templates.md` "Riskiest step" and SKILL.md Stage 3.
- The real `pnpm dev:seed` run plus the SC-7 browser check found the human showcase diagram being flagged and hidden from Seed Planting, which no test could see. It was recorded as a divergence and fixed with an inner test shown RED. Same lesson as MF-0008 (`mocked-tests-miss-real-input`). Keep: already is, in SKILL.md Stage 2 ("run the real command once") and the LOOP-PLAN divergence rule.
- Fresh-context review earned its cost at high-risk: both blocking findings were invisible to the frozen tests, and each fix got a regression test shown RED before the fix, with the failing line pasted in LOOP-VERIFY. Keep: already is, in SKILL.md Stage 5 (line ~259).
- Preflight before freeze (255/255, test:db 32/32 on the running stack) and DB tests using their own run-scoped email domain meant no proof needed `db:reset`. Keep: already is, in the "fixture and teardown must survive the freeze" paragraph of SKILL.md.

## Went wrong
- Review blocking 1: the manifest of seeded attempt ids survived `pnpm db:reset`, but serial ids restart, so a stale id could match a hand-played answer of yours and delete it. The plan guard was "ids recorded by the previous run AND owned by you". That guard is true on the same stack and false across a reset. Cause: wrong-plan. The riskiest-step section asked "what does a wrong filter delete" but not "what state outlives a reset or a re-run that this tool does not own", so the question never came up.
- Review blocking 2: reviews could be re-planned onto items the maintainer had already rejected or dismissed, because that decision lives in a table the seed does not own and survives re-runs. Cause: wrong-plan, same root as blocking 1. Both are "a re-runnable writer assumed it was the only writer to its tables".
- One inner regression test was first written green on the old code (not discriminating) and had to be rewritten to show red. A `git stash` of an untracked file did not stash it, so the "unfixed code" run was not unfixed. Cause: tooling. The skill says "stash the fix" but `git stash` skips untracked files, and every new file in this ticket (`src/dev-seed/**`) was untracked.
- Review round 2 notes: the DB tests (seed 42, no `excludeItemIds`) fail if you reject the seeded flag in the browser, which is the SC-7 workflow. This is environment coupling, listed as a known limit in evidence. Cause: wrong-test, minor.

## Actions (at most two)
1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/SKILL.md`, Stage 3, after the paragraph ending "(MF-0007 retro: a sync that ran ahead of a deploy let verdicts land on unread content)" (the stage that contains "Write `LOOP-PLAN.md`" is where the riskiest step is written; adding it next to the versioned-content rule keeps both riskiest-step musts together). Add this paragraph:
   "A plan for anything that writes or deletes and can be run twice (a seed, a sync, an importer, a backfill) must list, in the riskiest-step section, every piece of state it does NOT own that survives a re-run or `pnpm db:reset`, and name the test for each. Ask: (a) which ids or manifests it keeps on disk, and do they stay valid after a reset (serial ids restart, auth uuids change)? Bind a stored id to the owner and the epoch that wrote it. (b) which decisions another actor makes between runs (reject, dismiss, approve, hand-played answers), and does the re-run respect them? Each gets a regression test shown RED before it is called done (MF-0029: a manifest id reuse after a reset could delete hand-played answers, and re-planned reviews landed on rejected items, both found only in review)." Would have saved: review round 1 and both fix cycles (the blocking findings were predictable from the plan).
2. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/SKILL.md`, the Stage 5 sentence "run it against the unfixed code (stash the fix), paste the failing line". Replace "(stash the fix)" with "(revert the fix by copying the file aside, or `git stash -u`; plain `git stash` leaves untracked files in place, so the run is not against the unfixed code, MF-0029)". Would have saved: one non-discriminating test written and then rewritten, and the doubt about whether the pasted RED line was real.

## Not worth changing
- Whole-day FSRS rounding forced a persona retune, and "you" limited to 20 skills because SC-7 named seeds the plan did not produce. Both are the engine's real behaviour surfacing at the first real run, recorded as divergences as the process says. Specific to this seed's data.
- The DB tests (seed 42, no exclusion list) failing if you reject the seeded flag: a known limit already in evidence. The fix is `await listResolvedItems(db)` in `seed-regressions.db.test.ts`, a one-line change for whoever next touches it. The frozen file cannot change.
- Review notes still open (a demo group's cascade removes an invited non-demo member, reviews dated before memberships, steps a/b/d outside the transaction): accepted, stated in REVIEW.md, no user path affected today.
- No gate: neither blocking finding is detectable by a static check. They are about what state exists at run time.

## Applied

2026-11-04, automatic policy:
- Action 1 (skill-edit, additive): `.claude/skills/gsd-goal-loop/SKILL.md`, after the MF-0007 version-binding
  paragraph: re-runnable writers list the state they don't own that survives a re-run or reset, each with a RED-first test.
- Action 2 (skill-edit, additive clarification): same file, the RED-first step: "(stash the fix)" now names copying the
  file aside or `git stash -u`, because plain `git stash` skips untracked files. Nothing removed or loosened.
- Held: nothing.
