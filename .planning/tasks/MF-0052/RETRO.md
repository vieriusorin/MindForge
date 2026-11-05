---
ticket: MF-0052
outcome: pass
causes: known-trap-repeated
actions: gate
applied: 2026-11-05
lesson_keys: design-preflight-sc-preconditions, shared-devtools-browser, rerunnable-writer-surviving-state, red-first-regression-test
---
## Numbers
(`node scripts/lib/ticket-retro.mjs MF-0052` printed nothing and `pnpm ticket:retro` is not wired; counts taken by hand from GOAL.md, FROZEN.json and LOOP-VERIFY.md.)
- Tier high-risk, `last_iteration: 0`; fresh-context review: approve, 0 blocking (majors resolved: plan amended with T0b, SC-9 browser half listed as not verified).
- RED at freeze: `7 failed | 618 passed` (only the 5 MF-0052 acceptance files), identical on a 2nd run; probe showed each assertion fails for the SC's own reason.
- Gates at TEST: typecheck 0, lint 0, `pnpm test` 141 files / 653 tests, `pnpm test:db` 25 files / 109 tests, `pnpm build` 0.
- Re-freezes: 1 (MF-0013 storms DB fixture, user-approved, history in MF-0013/FROZEN.json). MF-0052's own 5 frozen files: hashes unchanged.
- DESIGN preflight line: `pnpm typecheck && pnpm lint && pnpm test exit 0 (134 files, 617 tests)`. No `test:db`, although SC-10 names it.

## Went right
- Guard regressions were each shown RED by removing the guard (V1 unfinished-storm check, V2 pre-delete seedability check, V3 delete-by-manifest-id), with `cmp` confirming the restore. This applied the MF-0029/MF-0034 lessons (validate before destroy, rerunnable writer). — keep: already is (MF-0034 RETRO actions in `gsd-goal-loop` references).
- At PLAN the orchestrator grepped for frozen collisions (MF-0029/MF-0034 per-learner attempt counts vs `finalize_storm` inserting attempts) and chose "storm answers stay out of `world.attempts`", so no re-freeze of MF-0029/MF-0034. The one re-freeze came from a different file. — keep: already is (Stage 3 frozen-collision grep, MF-0025 edit).
- The shared browser was held by another session. The session went to the HTTP fallback at once (minted local session, all 14 routes fetched, cookie deleted) and recorded SC-9 as PARTIAL, never PASS. — keep: already is (`feedback-browser-verification.md`, line 16).
- The user was asked about the MF-0013 re-freeze with the cause named (fixture took the first 3 D2 questions; seed flags `ccdv-f.D2.S2.q1`), and the history is in both FROZEN.json files. — keep: already is (Stage 4 re-freeze with a recorded reason).

## Went wrong
- DESIGN preflight ran `typecheck && lint && test` but not `pnpm test:db`, though SC-10 says "`pnpm test:db` exits 0" and the ticket's whole subject is a seed that changes what a seeded DB holds. The red (`mf-0013-storms`, `not a playable question for this storm`, `Tests 7 failed | 1 passed (8)` on a seeded DB) surfaced only in TEST, needed an amendment (LOOP-PLAN "Amendment ... T0b") and a user-approved re-freeze. cause: known-trap-repeated. `SKILL.md` Stage 2 preflight (1) already says "plus every other command an SC names as its proof (`pnpm test:db` ...; MF-0025: a `test:db` red found only in TEST forced an SC amendment)". MF-0025's RETRO called this same miss ("written, then missed, on 10+ tickets") and the edit it made was prose. It was missed again, with the same file (`mf-0013-storms`) and the same red. The LOOP-PLAN even states "which DESIGN preflight did not do".
- Housekeeping contradiction left behind: `.planning/tasks/MF-0050/GOAL.md` is still `reserved` for "fix the mf-0013-storms baseline red" and MF-0052's T0b now fixes that fixture. cause: none (scope), listed under Not worth changing.

## Actions (at most two)
1. gate: `scripts/lib/planning-check.mjs` (pure decision, add a case) wired through the existing `pnpm gate:planning` (`scripts/check-planning.mjs`, already in the Stop gate and CI); test in `scripts/lib/__tests__/` or the existing planning-check test. Check: for every GOAL.md whose `goal_status` is not `reserved` and whose dir sorts after `MF-0052` (so history is not retro-flagged), take the "## Success Criteria" section, collect every `pnpm <script>` token it names (`test:db`, `build`, `check:packs`, `test`, `typecheck`, `lint`), and require the "## Iteration Log" line containing "design preflight" to mention each one. When a name is missing, print `MF-XXXX: design preflight does not mention pnpm test:db, named by an SC`. If the log has no "design preflight" line and `stage` is past `design`, flag that too. It would have flagged MF-0052 (SC-10 names `pnpm test:db` and `pnpm build`; the preflight line names neither) and MF-0025 (SC-6). Do not edit the SKILL.md prose; the gate is the fix. A preflight line may say "not run: <reason>" for a command and still pass, so a deliberate skip stays possible. Would have saved: the T0b amendment, one user checkpoint and a re-freeze of a frozen MF-0013 file, found at DESIGN instead of TEST (about one extra planning round-trip and a re-run of the `test:db` suite).

## Not worth changing
- Browser locked by another session, SC-9 browser half unverified: second ticket in a row (MF-0034) but the memory entry `feedback-browser-verification.md` already prescribes the HTTP fallback and the session followed it exactly. The only gap is that SC-9's text said "browser check on port 3001" without the memory's suggested "or HTTP render if the browser is held". That is a wording nit at DESIGN, no new rule.
- Stale reserved ticket: `.planning/tasks/MF-0050/GOAL.md` (`goal_status: reserved`) is made moot by MF-0052's T0b. The orchestrator should mark it superseded by MF-0052 at hand-off. One-off housekeeping, not a pattern.
- Review minors left as-is (manifest written after commit; "Not survived" vs "Not yet" wording; duplicate `RecentStormRow` types; boss route empty state for any domain): recorded in REVIEW.md and evidence "Not verified", no process cause.
- Token usage: no session metrics available; the ticket was 5 frozen files, 7 tasks and a 601-line plan, so its size explains the cost. No change proposed.

## Applied

- 2026-11-05 gate → reserved ticket `.planning/tasks/MF-0053/GOAL.md` (design-preflight check in `planning-check.mjs`); not built.
- Held: none (no memory or skill-edit actions).
- Housekeeping from the retro note: `MF-0050` (reserved for the same mf-0013 fixture red) set to `withdrawn`, superseded by MF-0052 T0b.
