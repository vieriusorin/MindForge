---
ticket_id: MF-0049
title: "check:goal-proofs for Success Criteria proof paths"
tier: high-risk                   # a new check script (scripts/check-*.mjs is a guarded gate path; MF-0055: tooling that gates is high-risk)
stage: test
branch: feat/MF-0049
builds_on: [MF-0024]
last_iteration: 0
goal_status: in-progress
---

> Reserved by the MF-0024 retro (2026-11-05, lesson `sc-proof-claim-unverified`). Picked up 2026-11-06.

## Objective

**Today.** A GOAL.md Success Criterion can name a proof file or command that does not exist, and only a fresh-context
review notices. MF-0024 SC-3 named `src/server/db/__tests__/mf-0024-sync-prefix.db.acceptance.test.ts`, which never
existed (the frozen file is `mf-0024-id-prefix.db.acceptance.test.ts`). It was found at review, after the freeze.

**End state.** `scripts/check-goal-proofs.mjs` (`pnpm check:goal-proofs <ID>`) runs in the gsd-goal-loop TEST stage
before REVIEW. It exits 1 listing every proof reference it cannot resolve, and every frozen file no record names.

## Facts (re-derived at pickup, 2026-11-06)

- F-1: the MF-0024 GOAL was never committed with the bad path, because the fix landed before the first commit
  (`git log -S sync-prefix` finds only the RETRO/REVIEW text). SC-1's "`git show` of the pre-fix text" cannot exist.
  The fixture is today's MF-0024 GOAL with `mf-0024-id-prefix.db` replaced by `mf-0024-sync-prefix.db` in SC-3.
- F-2: a read-only probe of the drafted rules over the 48 GOALs at `stage: handoff|watch` was too noisy as drafted.
  - Rule (b), "every frozen path appears in GOAL.md", flagged 58 files. GOALs say "Proof: frozen acceptance test" and
    the paths live in FROZEN.json, LOOP-PLAN and LOOP-VERIFY.
  - Rule (a) on whole SC bullets flagged example inputs (`scripts/x.mjs` in MF-0048 SC-1), placeholders
    (`packs/<slug>/pack.yaml`) and bare basenames that exist elsewhere.
  - Rule (c) matched prose ("pnpm from").
- F-3: the probe with the tightened rules below gives 1 + 10 + 0 hits:
  - (a) MF-0016 SC-1 names `src/engine/content/__tests__/mf-0016-cuckoo-schema.acceptance.test.ts`, which does not
    exist; the frozen file is `mf-0016-cuckoo.acceptance.test.ts`.
  - (b) 10 frozen files in MF-0012 (3), MF-0026 (2), MF-0029 (2), MF-0031 (1) and MF-0034 (2) are named in none of
    GOAL, LOOP-PLAN or LOOP-VERIFY.
  - Separately, 9 SCs in shipped GOALs have no `Proof:` at all.

  These are findings about shipped records. This ticket does not fix them.

## Success Criteria (draft)

- [ ] SC-1: rule (a). Every backticked token in the `Proof:` part of an SC must resolve:
  - a path (under `src/`, `scripts/`, `supabase/`, `packs/`, `e2e/`) must exist on disk;
  - a bare test-file basename (`*.test.ts(x)`) must exist somewhere in `git ls-files`.

  Tokens with `<`, `>`, `*`, `{` or whitespace are not paths. On the F-1 fixture, the check exits 1 and names
  `mf-0024-sync-prefix.db.acceptance.test.ts` and SC-3. Proof: frozen acceptance test (spawns the CLI with
  `MF_TASKS_DIR`).
- [ ] SC-2: rule (b). Every `FROZEN.json` `files[].path` must be named (by path or basename) in the ticket's GOAL.md,
  LOOP-PLAN.md or LOOP-VERIFY.md. A fixture with an unnamed frozen file exits 1 and names it. Proof: frozen acceptance
  test.
- [ ] SC-3: rule (c). A backticked `pnpm <script>` in a `Proof:` part must be a `package.json` script, or one of
  `exec`, `dlx`, `install`, `vitest`. A fixture naming `pnpm check:nope` exits 1. Proof: frozen acceptance test.
- [ ] SC-4: fail closed. A missing GOAL.md, unreadable FROZEN.json JSON, or an SC with no `Proof:` is an error, and a
  GOAL whose proofs all resolve exits 0. Today's MF-0024 records also exit 0. Proof: frozen acceptance test.
- [ ] SC-5: wiring. `package.json` gains `"check:goal-proofs"`, and SKILL.md Stage 4 gains a step to run
  `pnpm check:goal-proofs <ID>` before the fresh-context review. Proof: the diff, plus running it on MF-0049 itself
  at TEST.

## Constraints → how met

- Gate scripts and `package.json` are guarded → user approval at this checkpoint; each guarded edit prompts.
- It does not judge whether a command *covers* an SC: that stays with the drafter (memory
  `feedback-verify-derived-facts`).
- The parser fails closed by an allowlist (verification.md §4; LOOP-PLAN `## Parsers`, MF-0048 retro).

## Concerns

| # | Concern | Owner | Status |
|---|---|---|---|
| C-1 | Rule (b) scope (F-2): the draft asked for GOAL.md only, which flags 58 files in 40 tickets. Proposed: GOAL, LOOP-PLAN or LOOP-VERIFY (10 real hits). SC-1's "unmentioned frozen DB file" half is then not reported for MF-0024, whose LOOP-PLAN names it. | user | resolved 2026-11-06 (user): GOAL, PLAN or VERIFY |
| C-2 | Rule (d), an SC without `Proof:` is an error (9 shipped SCs would fail). In or out? | user | resolved 2026-11-06 (user): error (SC-4) |
| C-3 | Enforcement: a CLI plus a SKILL.md step only, or also a `gate:` script run for every ticket at handoff (that would touch `gate:planning`, which MF-0060, the other contributor's ticket, is changing)? | user | resolved 2026-11-06 (user): CLI + skill step; plan approved |

## Iteration Log

- 2026-11-06 · intake→design · claimed (#79). proof-case replay: RED (F-1 fixture; the tightened rule (a) flags
  `mf-0024-sync-prefix.db.acceptance.test.ts` in SC-3, read-only probe).
- 2026-11-06 · design→plan · checkpoint: C-1 GOAL/PLAN/VERIFY, C-2 SC without Proof: is an error, C-3 CLI + skill
  step; plan approved (high-risk). design preflight: `pnpm typecheck` exit 0, `pnpm lint` exit 0, `pnpm test` exit 0
  (main dc4e9b2); `pnpm check:goal-proofs` not run: does not exist yet (SC-1..5 create it). No proof wipes state.
