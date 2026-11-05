---
ticket: MF-0022
outcome: parked
causes: missing-context, scope
actions: skill-edit
applied: 2026-11-05
lesson_keys: design-preflight-sc-preconditions, probe-library-behaviour-before-oracle, load-external-api-skill-before-sc
---
## Numbers
(`pnpm ticket:retro` does not exist; facts gathered by hand from GOAL, LOOP-PLAN, LOOP-VERIFY, FROZEN.json, git.)
- Stage `build`, `goal_status: blocked-on-user`, `last_iteration: 0`; one freeze (FROZEN.json `931247e1…4c1c`), no refreeze.
- RED at freeze: 11/11 failed for the right reason (after one vacuous case was tightened).
- Gate at pause: typecheck ok, lint 546 files ok, test 123 files / 542 tests ok (baseline 121 / 528).
- Diff: 11 files modified, +250 / -43 (3 prompts re-locked, 3 CLIs, `prompts.ts`, `pipeline.ts`, `package.json`) plus new `eval.ts`, `eval-report.ts` and 2 test files.
- Paid runs: 0. SC-2/SC-3 offline parts built; SC-3 real proof, SC-4, SC-5, SC-6, SC-8 wait for `ANTHROPIC_API_KEY`.

## Went right
- Discovery at DESIGN found, before any code, that the writer, card and diagram prompts hard-code "Claude Certified Developer – Foundations exam" (would mislabel 6 of 7 packs), and that no `ANTHROPIC_API_KEY` is in `.env.local`. Both became SC-2 and C-0 instead of BUILD surprises. — keep: already is (SKILL.md Stage 2 preflight, MF-0012/MF-0019 precedents).
- RED-at-freeze run against a throwing typed stub exposed a vacuous case (`toThrow()` with no matcher passed against the stub) and it was tightened to `toThrow(/\{\{audience\}\}/)` before freezing. — keep: already is (SKILL.md line ~222, "if it stays green, the case is vacuous"). The rule worked; do not restate it.
- A probe of `scoreItemEval` showed a flaw with 0 planted scores 1 (`item-eval.ts:131`), a vacuous pass. That produced the `untested` status and a pure `judgeEvalSet` instead of leaning on the library scorer. — keep: already is (lesson key `probe-library-behaviour-before-oracle`).
- Required `packName` on `loadPrompts` (rejected the optional-with-CCDV-F-default option) so `tsc` finds every caller. — keep: already is, LOOP-PLAN "Rejected options".
- When the key was missing the session finished all offline work (prompts, eval command, judge) and parked at T5 rather than stalling. No spend, no secret printed.

## Went wrong
- `questions.ts` had no `--domain` flag, although MF-0008 evidence already said "run per domain" and GOAL "Constraints → how met" states "CCDV-F questions run `--domain` / per-skill slices" as if it existed. Found only in BUILD and recorded as plan step 5b (GOAL Discovery table shows ccdv-f $70.55 > $50 cap; the dry-run output made the need visible, but nobody grepped the CLI's arg parser). cause: missing-context
- Scope was widened from `ccdv-f` to all 7 packs at the user's request after the draft was written. The re-discovery caught the prompt literal but the "how met" column still carried the single-pack assumption about the CLI. The widening changed the cap arithmetic (one pack-domain per batch) without a step that re-checks every named command and flag. cause: scope
- The user said "1 added" for the key; `.env.local` had none on two checks. One-off, handled by parking (see Not worth changing).

## Actions (at most two)
1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/SKILL.md`, Stage 2 preflight, insert after item (4) (the `main` CI check, ends "...6 PRs merged unverified).") and before "Then run `grill-with-docs`":

   > (5) For each SC or plan line that names a CLI flag or subcommand (`--domain`, `--skill`, `--dry-run`), grep the script's argument parser for it now (`grep -n -- '--domain' scripts/**/*.ts`). A flag that does not exist is a plan step with an owner at the checkpoint, not a discovery in BUILD (MF-0022: `--domain` was assumed from MF-0008 evidence and found missing in BUILD, step 5b). When the user widens scope at the checkpoint (one pack to seven, one skill to all), re-run this grep and also grep the code the wider scope reaches for literals naming the original subject (`grep -rn "Certified" prompts/ src/content-pipeline`), because a cap, a count or a hard-coded name sized for one case breaks at several.

   Would have saved: one unplanned BUILD step (5b) and the re-plan it forced; the same shape as the `design-preflight-sc-preconditions` lesson (8 earlier tickets), so it belongs in the preflight list that stage reads, not in memory.

## Not worth changing
- Key reported as added but absent: user error, caught by checking `.env.local` for the name; the discovery already records the check (names only, no values). Not a pattern.
- Vacuous `toThrow()` in the frozen test: caught by the existing RED-at-freeze rule. Older acceptance files still contain bare `toThrow()` (`mf-0008-pipeline.acceptance.test.ts:202,333,362`, `mf-0014-cards-diagrams.acceptance.test.ts:194`); a gate over them would flag frozen, grandfathered tests, so no gate is proposed.
- No token signal was available (no session metrics); the ticket's size (7 packs, three prompts, eval command) explains the context spent. No change.
- The monthly-cap stop rule (C-1) and `MF-0047` reservation are decided and unexercised; judge them after the first real batch.

## Applied

- 2026-11-05 skill-edit (additive) applied: `.claude/skills/gsd-goal-loop/SKILL.md` Stage 2 preflight item (5),
  inserted after item (4), before "Then run `grill-with-docs`". Nothing held; no memory or gate actions proposed.
