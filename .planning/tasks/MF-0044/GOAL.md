---
ticket_id: MF-0044
title: Key-length rule in check:packs
tier: high-risk                   # a gate script (scripts/check-*.mjs; MF-0055 retro: gates are high-risk); no app code, no DB
stage: handoff
branch: feat/MF-0044
goal_status: complete-pending-manual-commit
builds_on: [MF-0036, MF-0041, MF-0042]
last_iteration: 0
---

> Reserved 2026-11-04 by the MF-0042 retro (Action 1). Claimed 2026-11-06 (this session, user: "start it with
> /gsd-goal-loop"). `pnpm ticket:github MF-0044 --claim` cannot run: the `gh` token lacks `read:project`.

## Objective

**Today.** Nothing checks that a question's key is not the longest option. On MF-0042, 10 of 32 verifier FIX were
"key ≥ 1.15× the longest distractor", a tell a test-wise learner can use. The drafting brief said "similar length";
no test or gate enforced it.

**End state.** `pnpm check:packs` gains a key-length rule that needs no corpus, so it runs in CI too: every
`select: 1` question whose key text is ≥ 1.15× its longest distractor (in characters) is a problem naming the
question id, the key length and the longest distractor length. Packs in a named grandfather set are skipped with one
summary line until they are retrofitted.

## Facts (re-derived 2026-11-06; the reserved draft is a hypothesis)

- Read-only probe of the drafted rule over today's `packs/` (`select: 1` only, ratio = key chars / longest
  distractor chars): ccdv-f 40 of 48 (+5 `select: 2+` questions, out of the rule), worst 2.67; prod-prompting 28 of 54,
  worst 2.05; platform-foundations 2 of 54 (`D1.S1.q4` 1.21, `D4.S1.q2` 1.19); agent-skills 0/54 (worst 0.99),
  ai-capabilities 0/48 (1.00), claude-code-in-action 0/66 (**1.14**, 11 between 1.05 and 1.15), subagents 0/48 (1.12).
  The draft's "ccdv-f 44 of 53" counted the multi-select questions.
- proof-case replay: RED on shipped content (ccdv-f 40, prod-prompting 28, platform-foundations 2 hits without the
  grandfather set); GREEN on claude-code-in-action (0 hits), as the draft's proof case needs.
- Every shipped `select: 1` question has exactly one `correct: true` option and at least one distractor.
- MF-0041 set the precedent: a corpus-free rule in its own `scripts/lib/*.mjs`, run before the `.cache/corpus` early
  exit (`scripts/check-pack-grounding.mjs:38-52`). CI has no corpus; this machine has one (35 files).
- Only one test runs the script end to end: `mf-0041-flaw-key.acceptance.test.ts` SC-5, over a fixture pack with
  cuckoos and no questions, asserting exit 1 and two stderr strings. A question rule adds nothing to that fixture.
- Tier was `normal` in the draft; `scripts/check-*.mjs` is a gate script, so high-risk.

## Affected

- **Roles:** pack authors and AI drafters (the gate's output); no app user.
- **Surfaces:** `scripts/check-pack-grounding.mjs`, new `scripts/lib/key-length.mjs`, a new acceptance test.

## Constraints

- Corpus-free and before the corpus early exit, so CI enforces it.
- Fails closed (verification.md §4, MF-0043 retro): YAML it cannot parse, or a `select: 1` question without exactly
  one correct option and one distractor, is a problem, never a skip.
- Read-only; no new dependency (`yaml` is already used by `cuckoo-flaw-key.mjs`).
- Guarded edit: the gate script.

## Decided without a question

- Only `select: 1`: with several correct options the "key" is a set, and the drafted rule has no meaning there. Out
  of scope, not skipped silently: the summary line counts them.
- Boundary: `ratio >= 1.15` fails (the draft's operator); 1.1499 passes.
- The grandfather set is keyed by pack directory name, the same slug `MF_PACKS_DIR` fixtures use.
- Problem message: `<file>: <question id>: key is <k> chars, longest distractor <d> (<ratio>×, limit 1.15×)`.

## Success Criteria

- [x] SC-1: A fixture pack (`MF_PACKS_DIR`) with a `select: 1` question whose key is 1.20× its longest distractor
  makes `check:packs` exit 1; stderr names the question id, the key length and the longest distractor length.
  Proof: frozen `src/test/__tests__/mf-0044-key-length.acceptance.test.ts`.
- [x] SC-2: Boundary: 1.10× passes, exactly 1.15× fails. Proof: same file.
- [x] SC-3: A question with the 1.20× key in a pack named in the grandfather set is not a problem, and the summary
  line reports the skipped count. Proof: same file.
- [x] SC-4: Fails closed: unparseable question YAML, and a `select: 1` question with zero or two correct options, are
  problems naming the file / question id. A `select: 2` question is not checked and is counted. Proof: same file.
- [x] SC-5: The rule runs when `.cache/corpus` is absent (the CI path). Proof: `pnpm check:packs` with the corpus
  moved aside and restored, output in LOOP-VERIFY; review of the call order.
- [x] SC-6: Every shipped pack outside the grandfather set passes; `pnpm check:packs` exits 0 on this repo.
  Proof: same file (a case over the real `packs/`) + command output.
- [x] SC-7: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm gate:planning` pass. Proof: receipt.

## Constraints → how met

- Corpus-free, before the exit → SC-5.
- Fails closed → SC-4.
- No new dependency → `yaml`, already in `dependencies`.
- Guarded edit → C-1.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | The deliverable edits the guarded gate script `scripts/check-pack-grounding.mjs`. | user | resolved 2026-11-06 (user): approved |
| C-2 | Threshold 1.15× in characters. claude-code-in-action passes at 1.14 (11 questions between 1.05 and 1.15), so a lower threshold fails a clean shipped pack. | user | resolved 2026-11-06 (user): 1.15× in characters |
| C-3 | Grandfather set and retrofit: ccdv-f (40), prod-prompting (28), platform-foundations (2). Retrofit is content work (re-grounded rewrites); the draft leaves it to a later ticket. | user | resolved 2026-11-06 (user): grandfather all 3; retrofit reserved as MF-0059 (MF-0058 was taken by issue #90) |

## Decided by the user (DESIGN checkpoint, 2026-11-06)

- C-1 approve the gate-script edit · C-2 threshold 1.15× in characters · C-3 grandfather ccdv-f, prod-prompting,
  platform-foundations; retrofit is reserved MF-0059.
- SCs frozen as written. No proof wipes or restarts shared local state.

## Out of Scope

- Rewriting any question (the retrofit).
- A rule for `select: 2+` questions.
- Word-based length, or a length rule for rationales.

## Open questions

- none.

## Iteration Log

<!-- append-only -->
- 2026-11-06 · intake→design · Claimed. Facts re-derived (above). proof-case replay: RED (drafted rule on shipped ccdv-f,
  prod-prompting, platform-foundations: 40 / 28 / 2 hits) and GREEN on the named proof case claude-code-in-action (0).
- 2026-11-06 · design preflight: `pnpm typecheck` exit 0 · `pnpm lint` exit 0 · `pnpm test` 157 files / 812 passed ·
  `pnpm gate:planning` ok (56) · `pnpm check:packs` exit 0 (7 cuckoo files, 270 items checked, 0 problems) · `main` CI
  last 3 runs `success`. Proof steps: SC-5 moves `.cache/corpus` aside and restores it (local cache, not shared state).
- 2026-11-06 · design→plan · DESIGN checkpoint: user resolved C-1/C-2/C-3; MF-0059 reserved for the retrofit. RED
  frozen: 1 file, 5 cases (LOOP-VERIFY "RED at freeze"; FROZEN.json). → PLAN (high-risk: plan approval).
- 2026-11-06 · plan→build→test→handoff · User approved the plan. T1 lib + inner tests, T2 wiring; SC-5 proven with the
  corpus moved aside and restored. Review round 1 approve (4 minor; minor 1 broke fail-closed in grandfathered
  packs), fixed RED-first, round 2 approve (`92bd7cfb…`). Receipt: LOOP-VERIFY.md. Evidence: MF-0044.md.
