---
phase: 0-verification
ticket_id: MF-0058
status: done
verdict: PASS
started_at: "2026-11-06"
completed_at: "2026-11-06"
resume_with: /gsd-goal-loop
---

# Verification — Iteration 0 (RED, frozen 2026-11-06)

## RED at freeze (Stage 2b)

Written from the SCs alone (2026-11-06). Frozen 2026-11-06: FROZEN.json written by the orchestrator (no `ticket:freeze` script), hashes re-computed. `pnpm typecheck` 0,
`pnpm lint` 0. `pnpm test`: 37 failed / 812 passed (849); the 812 are the design-preflight baseline, every
red is in the files below. `pnpm test:db`: 14 failed / 120 passed; the 120 are the baseline. The DB files were
run twice; the second run gives the same reds and leaves no rows (attempts, keys, users for `mf0058*`: 0).

| SC | Acceptance test | Red reason at freeze (pasted) |
|----|-----------------|-------------------------------|
| SC-1 | `src/engine/path/__tests__/mf-0058-path-file.acceptance.test.ts` | schema/check cases: `Error: not implemented` (typed stubs `parsePath`, `checkPath`); refusal: `AssertionError: expected [Function] to throw error matching /paths\/p\.yaml/ but got 'not implemented'`; yaml: `Error: ENOENT: no such file or directory, open '…/paths/claude-developer.yaml'`; script: `AssertionError: expected [] to have a length of 1 but got +0` (check:packs prints no path problem; it exits 1 today only on the 7 C-4 baseline problems) |
| SC-2 | `src/engine/path/__tests__/mf-0058-course-complete.acceptance.test.ts` | `Error: not implemented` (typed stub `isCourseComplete`), all 9 rows |
| SC-3 | `src/engine/path/__tests__/mf-0058-path-progress.acceptance.test.ts` | `Error: not implemented` (typed stub `pathProgress`), all 9 rows |
| SC-4 | `src/server/paths/__tests__/mf-0058-course-completion.db.acceptance.test.ts` | `Error: not implemented` (typed stub `recordCourseCompletion`); 3rd case `PostgresError: relation "public.course_completions" does not exist` |
| SC-5 (DB) | `src/server/db/__tests__/mf-0058-paths-rls.db.acceptance.test.ts` | `PostgresError: relation "public.course_completions" does not exist` / `relation "public.path_enrollments" does not exist` / `expected { code: 'PGRST205', … } to be null`; actions `Error: not implemented` (typed stubs `startPath`, `leavePath`) |
| SC-5 (lock) | `src/server/paths/__tests__/mf-0058-recorder-wiring.acceptance.test.ts` | `AssertionError: expected [ Array(1) ] to deeply equal [ …(2) ]` (only get-group-heatmap.ts imports the secret client) |
| SC-6 (calls) | same file | `AssertionError: expected [] to include 'src/server/attempts/grade-answer.ts'` / `'…/grade-cuckoo.ts'` / storm: `expected [] to not deeply equal []` |
| SC-6 (throw) | `src/features/__tests__/mf-0058-recorder-failure.db.acceptance.test.ts` | `AssertionError: expected "vi.fn()" to be called with arguments: [ ObjectContaining{…} ]`. The `ok` result and the attempt-row assertions before it already pass, so the fixture is sound and the red is "the recorder is not on the grading path" |
| SC-8 | `src/features/paths/__tests__/mf-0058-path-parity.acceptance.test.ts` | path page: `Error: ENOENT … src/app/(app)/paths/[pathSlug]/page.tsx`; Today: `AssertionError: expected [] to not deeply equal []` |
| SC-9 | `src/features/app-shell/components/app-sidebar/__tests__/mf-0058-paths-link.acceptance.test.tsx` | `TestingLibraryElementError: Unable to find an accessible element with the role "link" and name "Paths"`. The tooltip technique was checked first on the existing "Today" item (collapsed sidebar, hover, `findByRole("tooltip")`): both cases pass |

SC-7 and SC-10 are browser and gate proofs: they have no frozen test.

Fixture check (SC-4): the FSRS memory was checked with the engine (`memoryBySkill` + `treeStage`, no fuzz) before
freeze. S1 right at -20 d and -10 d gives Sapling (stability 25.1 d). S2 right at -3 d gives Sprout (2.31 d), and
S2 right again now gives Sapling (13.8 d). Nothing checked the recorder against a reference implementation:
the tables don't exist and C-3 forbids `db:reset`.

## Iteration 1 — receipt (2026-11-06, stage: test)

Tree: `git diff main` including untracked files (intent-to-add, then index restored) → sha256
`39a17990fea40295823a759382bf13db0228d651573a794650ccff4a14d7ddeb`. No `ticket:verify` script exists; this is the
default receipt (skill binding VERIFY). Baseline (design preflight): `check:packs` exit 1 (7 problems, fixed by T0);
everything else green.

| Command | Exit | Output (last line) |
|---|---|---|
| `pnpm typecheck` | 0 | no errors |
| `pnpm lint` | 0 | `Checked 707 files in 123ms. No fixes applied.` |
| `pnpm test` | 0 | `Tests  912 passed (912)` |
| `pnpm test:db` | 0 | `Tests  134 passed (134)` |
| `pnpm check:packs` | 0 | `check:packs: 7 cuckoo file(s), 1 path(s), 485 item(s) checked, 5 skipped (source not cached), 0 problem(s)` |
| `pnpm gate:planning` | 0 | `gate:planning: 58 ticket folders checked, ok` |
| `pnpm build` | 0 | `✓ Compiled successfully` |
| frozen hashes (every `.planning/tasks/*/FROZEN.json`) | — | 0 mismatches |

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | `mf-0058-path-file.acceptance` 11/11; `check:packs` 1 path 0 problems; with `.cache/corpus` moved aside a bad fixture (unknown + duplicate) exits 1 printing both lines |
| SC-2 | PASS | `mf-0058-course-complete.acceptance` 9/9 |
| SC-3 | PASS | `mf-0058-path-progress.acceptance` 9/9 |
| SC-4 | PASS | `mf-0058-course-completion.db.acceptance` 3/3 (local stack) |
| SC-5 | PASS | `mf-0058-paths-rls.db.acceptance` 10/10; `mf-0058-recorder-wiring.acceptance` 4/4 (importer lock = 2); MF-0005 grants 3/3 after the approved re-freeze |
| SC-6 | PASS | `mf-0058-recorder-failure.db.acceptance` 1/1; wiring test finds `recordCourseCompletion(` in grade-answer, grade-cuckoo, storm |
| SC-7 | PASS | browser, `strong@mindforge-demo.test`: not enrolled / Start / enrolled (light, dark, 375px, no h-scroll) / Complete · date / Leave from the menu; screenshots in `.planning/evidence/MF-0058/` |
| SC-8 | PASS | `mf-0058-path-parity.acceptance` 2/2; browser: Today card "Course 1 of 5 · 0 of 5 complete · Continue → /play/ai-capabilities/walk" = path page; no card after Leave |
| SC-9 | PASS | `mf-0058-paths-link.acceptance` green; MF-0052/MF-0054 sidebar tests green; browser: Paths in Workspace |
| SC-10 | PASS | CONTEXT.md terms present; all commands above exit 0; evidence has "See it yourself" |

Review: `REVIEW.md` (diff-reviewer, fresh context) verdict **approve**, 0 blockers, 3 should-fix, bound to
`0d0edfdd…` (tracked diff; untracked files read in full). Post-review changes, UI copy only (no delete, auth or
privileged-client path), each with its test: `src/features/paths/utils/path-display.ts` (" UTC" on completion dates;
test shown RED first: `expected '5 Nov 2026' to be '5 Nov 2026 UTC'`), `src/features/paths/components/path-view/
{path-view.tsx,utils.ts}` (source note "not a record on Anthropic's side", labelled link), `path-list.tsx` (missing
space in the link name). Post-review change to those paths not re-read by the reviewer.

## Not verified

- ~~SC-4 against a working recorder~~ — now green (iteration 1).
- The "Complete · date" screen used a completion row inserted by hand on the local DB (`strong`, platform-foundations);
  no demo learner has a fully grown course. The real write path is proven by SC-4's DB test, not by the screen.
- Path complete (trophy) state not seen in the browser; covered by `pathProgress` oracle + `trophyLine` unit test.
- Pre-existing, not this ticket: at 375px the shared sidebar (`AppLayout` → `Sidebar`) logs a hydration mismatch on
  every signed-in route, including `/groups`, which this ticket does not touch.
