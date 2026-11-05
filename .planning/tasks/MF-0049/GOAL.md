---
ticket_id: MF-0049
tier: normal                      # dev tooling: a GOAL proof-path check; no app code
stage: intake
branch: main
builds_on: [MF-0024]
last_iteration: 0
goal_status: reserved             # created by the MF-0024 retro (gate action); never built automatically
---

> Reserved by the MF-0024 retro (2026-11-05, lesson `sc-proof-claim-unverified`).

## Objective

Today a GOAL.md Success Criterion can name a proof file or command that does not exist or does not cover it, and
only a fresh-context review notices. MF-0024 SC-3 named `src/server/db/__tests__/mf-0024-sync-prefix.db.acceptance.test.ts`
(never existed; the frozen file is `mf-0024-id-prefix.db.acceptance.test.ts`), and SC-4 named `pnpm check:packs`,
which never calls the validator. Both were found at review, after the freeze.

End state: `scripts/check-goal-proofs.mjs` (`pnpm check:goal-proofs <ID>`), run before REVIEW in the gsd-goal-loop
TEST stage, exits 1 listing (a) every backticked path on an SC bullet / `Proof:` text under `src/`, `scripts/` or
`supabase/` (or matching `*.test.ts(x)`) that is not on disk, (b) every `FROZEN.json` `files[].path` that the GOAL
does not mention, (c) every `pnpm <script>` named as proof that is not in `package.json`.

## Success Criteria (draft)

- [ ] SC-1: on MF-0024's GOAL.md as it was before the review fix (`git show` of the pre-fix text as a fixture), the
  check reports the missing `mf-0024-sync-prefix.db.acceptance.test.ts` path and the unmentioned frozen DB file. Proof: unit test.
- [ ] SC-2: on every current `.planning/tasks/*/GOAL.md` in `stage: handoff`, hits are listed as findings in this
  GOAL before freezing (first run of a new check is a review of existing content). Proof: read-only probe output.
- [ ] SC-3: a GOAL whose proofs all exist passes. Proof: unit test.

## Constraints

- Gate scripts, hooks and `package.json` are guarded config: the user approves the change and the wiring.
- Does not judge whether a command *covers* an SC (that stays with the drafter, memory `feedback-verify-derived-facts`).
