---
verdict: approve
verdict_detail: APPROVE (after delta re-review)
reviewed_hash: 91d7005d5185d0403c13d72b1fdb9c55d4e1e912cb50b52555d394394c3f977d
reviewed_at: 2026-11-07T09:47:38Z
---
<!-- Written by the fresh-context diff-reviewer; saved by the orchestrator because the reviewer's scope hook
     resolves the project root to the main checkout and refused a write inside the worktree. Text unchanged. -->

Hash definition (same as the LOOP-VERIFY receipt, reproduced exactly):
`{ git diff HEAD -- . ':!.planning'; git ls-files --others --exclude-standard -- . ':!.planning' | sort | while read f; do cat "$f"; done; } | shasum -a 256`
(`.planning/**` excluded, so this file does not change the hash; code tree unchanged since receipt `95f1ace87a96`.)

## What I checked
- Frozen acceptance file sha256 `4aa37eaf…1920` matches FROZEN.json; acceptance + inner tests + frozen MF-0028/MF-0053 CLI tests pass (57/57); `pnpm gate:planning` exits 0.
- CI path simulated in a temp repo (detached merge commit, only `refs/remotes/origin/main`, no local `main`, main moved on with another ticket's file): rule 2 flagged only the PR's unowned file, not main's. The merge-ref diff is judged correctly.
- Scope-fit probes: service-builder `src/features/**/actions.ts` flagged with witness `src/features/actions.ts` (correct in the hook's dialect, `**/` = `(?:.*/)?`); service-builder `src/features/*/actions*` flagged; ui-builder `src/**` flagged; acceptance-writer `__tests__/x.ts`, `src/**/__tests__/*.test.ts`, `[[...slug]]`, `{a}`, `{a,b}` pass; `{}` and nested braces give one syntax line each; `Src/…` flagged; worst-case glob ~1 ms.
- Siblings: read-only preview over the live worktrees MF-0061/0062/0063/0067 gives 0 rule-1 and 0 rule-2 lines; merging this does not redden them today.
- Every changed file is in this ticket's `owns`; nothing outside the approved list changed except tests and planning files.

## Findings
1. [should-fix] scripts/lib/planning-check.mjs:501,509 — grandfathered tickets' `owns` leak into the ownership union. `present` includes folders ≤ MF-0060 and line 509 unions all their tasks' `owns`. Live case: MF-0067 re-freezes `.planning/tasks/MF-0032/FROZEN.json` and `MF-0058/FROZEN.json`; with only MF-0067's own plan rule 2 flags 7 files (5 re-frozen acceptance tests, correctly exempt, plus `seed-checks.test.tsx` and `walk-session.test.tsx`); with the union it flags 0, because MF-0032's and MF-0058's plans own those two. That is the MF-0058 failure class let through by any refreeze. Fix: build the ownership set only from folders after OWNS_CUTOFF; keep FROZEN/RETRO exemptions from every folder in the set. Frozen SC-4 stays green (its second ticket is MF-0062).
2. [should-fix] scripts/check-planning.mjs:57-69 — the CI ref shape (detached merge ref, `origin/main` only, main moved on) has no test; the plan names it the riskiest step and LOOP-VERIFY lists it as Not verified. A later change (dropping `origin/main`, or diffing against `origin/main` instead of the merge base, which sweeps sibling merges in as deletions) would redden every hand-off PR with nothing failing locally. Fix: one inner test: commits A, B (feature), C (main), detached merge of C+B, `update-ref refs/remotes/origin/main C`, no local branches.
3. [should-fix] scripts/lib/planning-check.mjs:335-353 — `expandOwns` restates `expandBraces` from ticket-eval.mjs incl. the literal 64. If ticket-eval later allows nesting or raises the cap, `validatePlan` accepts a glob `expandOwns` rejects: rule 1 silently skips its scope check, rule 2 (`?? []`, ~:467) treats it as owning nothing and falsely flags every file under it. Fix: reserve a follow-up that exports it from ticket-eval.mjs.
4. [note] :210 — `hookGlobTokens` is a second copy of the util.mjs glob dialect; the brute-force oracle mitigates, but its alphabet `{a,b,/,x}` does not exercise braces or other specials.
5. [note] Rule 1 judges merged plans on main forever (cutoff by number). Main can go red later (a) when a sibling PR green before MF-0060 merges after it — re-run sibling CI after rebase or require up-to-date branches; (b) on any narrowing of SCOPES or addition to NEVER_GLOBS — the C-2 follow-up must be widen-only.
6. [note] The protected-file approval is cited only to the "orchestrator brief"; the committer should confirm the user approved the scripts/** and .claude/skills/** edits.
7. [nit] templates.md:172-173 still says "`inline` when the project has no role agents", contradicting the new paragraph below it.
8. [nit] :443 — the `## Applied` match must be exact; `## Applied (date)`, `` `path:12` `` or a glob exempts nothing (fails closed, but the R2 message then points to LOOP-PLAN). Add one clause to templates.md.
9. [nit] :191 `HANDOFF` duplicates the literal at :173; `PLAN_STAGES` (:190) duplicates `PAST_DESIGN` (:85). Reuse the existing names.
10. [nit] :483 — `TICKET_FOLDER` hardcodes `.planning/tasks/` while `MF_TASKS_DIR` can point elsewhere and `MF_REPO_DIR` defaults to the real repo, so the frozen CLI tests match fixture folders against the real branch's changed set (today only MF-0061 at design overlaps, harmless). Future CLI tests should set `MF_REPO_DIR` to a non-repo dir.
11. [nit] pre-existing: `.claude/scheduled_tasks.lock` is tracked; if Claude Code rewrites it in a ticket worktree, rule 2 flags it at hand-off. A chore ticket should untrack and ignore it.

## Intent vs letter
SC-1/2/3/4/6/7 assert full expected lines from the GOAL; SC-6 replays the real proof case from git objects — intent proved. SC-5 does not cover the CI ref shape (finding 2). SC-8 "rule 2 not skipped" is trivially true here (MF-0060 ≤ cutoff, so rule 2 judges nothing in this worktree); the cutoff-bypass self-check is not a recorded test. No SC covers finding 1.

## Verdict
APPROVE-WITH-FIXES: no blocker; nothing reddens main or current siblings; CI merge-ref path works in simulation. Fix 1 and 2 before merge (small, inside owned files, frozen tests stay green). Track 3 as a reserved follow-up.

## Delta re-review (orchestrator, 2026-11-07, tree 91d7005d5185d0403c13d72b1fdb9c55d4e1e912cb50b52555d394394c3f977d)
- Finding 1: `checkChangedFilesOwned` now takes `tasks` only from folders `> OWNS_CUTOFF` while FROZEN/RETRO exemptions
  still come from every folder in the set. Regression test seen RED on the unfixed code (`expected [] to deeply equal
  [ Array(1) ]`, LOOP-VERIFY), green now. Folder ids are fixed-width `MF-####`, so the string compare is sound. Resolved.
- Finding 2: two CLI tests on a detached merge with only `refs/remotes/origin/main`: owned → exit 0, no skip line;
  unowned PR file → exit 1, main's file never judged. Resolved (locks existing behaviour).
- Nits 7, 8, 9 applied. Finding 3 + builder follow-ups + 11 reserved as MF-0070. Notes 4, 5, 6, 10 accepted (6: the user
  picked MF-0060 up and approved agent-approved plans for high-risk tickets on 2026-11-06, U-2).
- Re-ran here: typecheck 0, lint 0, the two test files 31/31, `pnpm gate:planning` ok, hash reproduced. Verdict: APPROVE.
