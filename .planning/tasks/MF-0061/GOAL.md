---
ticket_id: MF-0061
title: Retrofit key-length tells in ccdv-f, prod-prompting, platform-foundations
tier: high-risk                   # edits a gate (scripts/lib/key-length.mjs) and re-freezes MF-0044's acceptance file; the rest is content
stage: handoff
branch: MF-0061
builds_on: [MF-0044]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Reserved 2026-11-06 from MF-0044 (user decision C-3 at the DESIGN checkpoint). Renumbered from MF-0059 on 2026-11-06:
> the MF-0058 merge (cc79c34) concatenated it into the other MF-0059 GOAL.md (issue #91). Issue #96. Picked up
> 2026-11-06 in the parallel run MF-0060..MF-0068 (worktree `mind-forge-MF-0061`).

## Objective

**Today.** MF-0044's key-length rule (`pnpm check:packs`: a `select: 1` key ≥ 1.15× its longest distractor, in
characters) skips three grandfathered packs (`GRANDFATHERED_PACKS` in `scripts/lib/key-length.mjs`). In those packs a
test-wise learner can still pick the longest option and be right in 70 of 156 single-select questions.

**End state.** Every flagged `origin: ai` question is rewritten so the key no longer stands out by length (distractors
lengthened with plausible-but-wrong, still-grounded content, or the key tightened), each rewrite re-grounded in the
page the item cites. The pack grandfather set is gone, so all three packs are length-checked. The two flagged
`origin: official` questions (of the 3 official ccdv-f items), verbatim copies of the Exam Guide, are not edited and are exempt from the length
comparison by origin (still structure-checked). `pnpm check:packs` exits 0.

## Facts (re-derived at pickup, 2026-11-06)

- Probe (the rule's own `charCount` and 1.15 limit, compareLengths forced on, over the worktree at `660f1c1`):
  **ccdv-f 40 of 48** select-1 (5 multi-select), **prod-prompting 28 of 54**, **platform-foundations 2 of 54**
  (`D1.S1.q4` 1.21×, `D4.S1.q2` 1.19×). Total 70. Same counts as MF-0044's probe; no correction.
- Correction to the reservation: 2 of the 40 ccdv-f hits are `origin: official` (ccdv-f has 3 official items; the third, `ccdv-f.D2.S3.official-1`, passes the rule) (`ccdv-f.D7.S1.official-1` 2.16×,
  `ccdv-f.D8.S3.official-1` 1.50×). CONTEXT.md:16 defines official as "copied verbatim from the exam guide"; MF-0003
  GOAL:33 "official questions are copied verbatim from Exam Guide v1.0 §8". They cannot be rewritten and stay
  official. 68 items are rewritable `origin: ai`.
- Every one of the 68 cites a URL whose text is in `.cache/corpus` (85 files, copied from the main checkout; the
  checker's own snapshot). The Exam Guide PDF is not cached, so the 2 official items could not be re-grounded anyway.
- No test asserts an option or stem text of these packs. Tests that name item ids use them as ids only
  (`review-actions.test.tsx`, `mf-0024-id-prefix.db.acceptance.test.ts`, `mf-0003-*`), and the official keys
  (`mf-0003-questions` SC: Sample 1/2/3 → B) are untouched.
- The MF-0044 frozen acceptance file asserts the grandfather set exists: SC-3 uses a `prod-prompting` fixture and
  expects `1 skipped (grandfathered)`; SC-6 expects `[1-9]\d* skipped (grandfathered)` on the repo. Removing the slugs
  (this ticket's purpose) turns both red, so that file is re-frozen (see Concerns C-2).
- Content hashes: `private.items.content_hash` is the canonical JSON of the item (`scripts/lib/content-hash.mjs`), so
  every rewritten item gets a new hash. Per MF-0032, an in-flight attempt bound to the old hash is refused and review
  state bound to the old version no longer applies. Answer keys (`private.question_keys`) do not change: key option
  ids are unchanged.

- U-6 probe (2026-11-07, scratchpad `mf0061/share.mjs`: per pack, `select: 1` excluding `origin: official`, key
  strictly longer than every distractor). At HEAD 660f1c1 → after the first pass:
  ccdv-f 41/45 (91%) → 23/45 (51%) FAIL · prod-prompting 47/54 (87%) → 37/54 (69%) FAIL · **claude-code-in-action
  26/66 (39%) FAIL** (outside the three; included here per U-6) · platform-foundations 14/54 (26%) → 12/54 (22%) ·
  subagents 6/48 (13%) · agent-skills 0/54 · ai-capabilities 0/48 (team-onboarding-sample has no questions).
  The reviewer's "42/68" counted ties and official items; the rule counts neither (U-6 spec).
- Opposite tell (finding only, not enforced, U-6): the key is NEVER the strictly longest option in agent-skills (0/54)
  and ai-capabilities (0/48), so "never pick the longest" is a tell there. Follow-up reserved by the orchestrator.
- Rebalance picks for the ~25% aim: the items where the key is only barely longest (ratio 1.006–1.071): ccdv-f 12
  (→ ≤ 11/45), prod-prompting 24 (→ ≤ 13/54), claude-code-in-action 10 (→ ≤ 16/66); list in scratchpad
  `mf0061/worklist2.json`.

- U-7 probe (2026-11-07, scratchpad `mf0061/rank.mjs`; key rank by length among 4 options, ties share the better rank;
  select 1, non-official), before the U-7 rewrites: agent-skills 0/14/11/29 (shortest 54%) FAIL · ai-capabilities
  3/24/15/6 (2nd 50%) FAIL · ccdv-f 17/20/6/2 (2nd 44%) FAIL · prod-prompting 15/36/3/0 (2nd 67%) FAIL ·
  claude-code-in-action 24/16/9/17 · platform-foundations 12/19/12/11 · subagents 9/12/13/14 (longest/2nd/3rd/shortest).
  At HEAD: ccdv-f 42/2/0/1, prod-prompting 49/4/1/0, claude-code-in-action 34/6/9/17. Every select-1 question in the
  repo has 4 options.

## Affected

- **Roles:** learners see new option wording in the rewritten questions (68 in the first pass, then the U-6 and U-7
  rebalances; the exact count per pack is in LOOP-VERIFY); reviewers see each rewritten item as a new version.
- **Surfaces:** question YAML in 6 packs, 111 questions in all (ccdv-f 38, prod-prompting 39, agent-skills 12,
  ai-capabilities 10, claude-code-in-action 10, platform-foundations 2); `scripts/lib/key-length.mjs`,
  `scripts/check-pack-grounding.mjs` (summary line, key-rank rule); tests `src/test/__tests__/key-length.test.ts`,
  MF-0044's acceptance file, MF-0061's two acceptance files; DB rows
  `private.items` (content hash) on the next `pnpm db:sync-keys`.

## Constraints

- Each rewrite stays grounded in the item's cited `source.url` (read in `.cache/corpus`), no invented facts → drafter
  brief + fresh verifier per group (SC-6).
- The four drafter checks (SKILL.md DESIGN): strictest rule + qualifier kept; 'always'/'by default' exceptions
  stated; rationale = the page's own reason; (diagram row n/a) → in the drafter brief, checked by the verifier.
- No new tells: no absolute words added to distractors only, no grammar mismatch with the stem, no distractor made
  partially true, no copy of the stem's words into the key only → verifier column "tells" (SC-6).
- Keep ≤ 4 options, the option ids, which option is the key, select 1, stem, source, level, origin → SC-4, SC-5.
- Validation is never skipped for a skipped comparison: an official question is still structure-checked (MF-0044
  review minor 1) → SC-2.
- Never edit a gate allowlist to go green → the grandfather set is deleted, not widened; the official exemption is a
  domain rule (CONTEXT.md:16), recorded below and in C-1.
- No source copying: no run of 12+ words copied from the cited page into an option → drafter brief; verifier spot
  check.

## Decided by the user

- U-1 (2026-11-06) the orchestrator commits, pushes, opens the PR and merges; this ticket never commits.
- U-2 (2026-11-06) high-risk plans are approved by the orchestrator agent; a fresh-context diff-reviewer runs before
  merge; `pnpm db:reset` on the LOCAL stack is allowed under the db lock.
- U-4 (2026-11-06) MF-0061 = all three packs (ccdv-f, prod-prompting, platform-foundations) in one ticket. Removing the
  three slugs from MF-0044's grandfather set is this ticket's purpose (MF-0044 C-3: "grandfather all 3; retrofit
  reserved"), not an allowlist edit made to go green.
- U-5 (2026-11-07) the MF-0044 SC-3/SC-6 re-freeze (C-2) is approved by the user.
- U-6 (2026-11-07) rebalance now, in this ticket (review finding 1): a pack-level rule in `check:packs` (key-length
  module): per pack, among `select: 1` questions excluding `origin: official`, the share where the key is the
  STRICTLY longest option (characters; ties don't count) must be ≤ 35%; the message names pack, count, share, limit;
  applies to every pack. New SC with a frozen acceptance test (RED first) plus unit tests (ties, official,
  multi-select, empty pack). Probe all packs; a failing pack outside the three is rewritten here too. Report the
  opposite tell (key never longest) as a finding only. Aim for ~25%. Same rewrite discipline, prefer lengthening a
  distractor over cutting the key's qualifiers; fresh verifier per group over the new rewrites; full ladder again.

- U-7 (2026-11-07) after the delta review (prod-prompting key among the two longest in 95%, 2nd longest 67%; ccdv-f
  2nd longest 44%; agent-skills key shortest 54%): replace the 35% longest-key cap with a RANK rule across all packs.
  Per pack, among `select: 1` questions excluding `origin: official`, rank the key by length among its options
  (1 = longest … shortest; ties share the better rank); no rank may hold more than 40%. Message names pack, rank,
  count, share, limit; integer math; a failing share is never printed equal to the limit; packs with fewer than 10
  such questions are skipped and the summary says so. Supersedes SC-9 (re-freeze of the share file, citing U-7);
  RED first. Rewrites aim for a near-uniform spread without filler (delta note 5); also fix delta notes 2, 4, 6, 7.

## Decided without a question

- The 2 `origin: official` items are not rewritten; the rule skips the length comparison for `origin: official`
  (structure still checked) and counts them as `skipped (official)` — follows from CONTEXT.md:16 (official = verbatim)
  and MF-0003 GOAL:33. The alternatives break a domain rule (rewrite but keep `official`) or two frozen files
  (relabel to `ai`: `mf-0003-questions` and `mf-0006-content` SC-3 count 3 official). Raised as C-1 for the
  orchestrator's review.
- The pack grandfather mechanism is removed, not left as an empty set: nothing remains in it, and an empty allowlist
  invites the next "add a slug to go green" (engineering-principles §3 YAGNI). The summary keeps its shape with
  `skipped (official)` in place of `skipped (grandfathered)`.
- Tier raised from normal to high-risk: the ticket edits a gate script and re-freezes a frozen file (HIGH_RISK
  binding; MF-0044 was high-risk for the same file). Plan approval is the orchestrator's (U-2); this agent cannot pause
  for it mid-run, so the plan is recorded and the approval point is the pre-merge review.
- Drafting by 5 groups (fresh-context drafter per group, disjoint files), then a fresh-context verifier per group —
  course-pack ticket shape (templates.md), MF-0042 precedent (`verify/G1..G4.md`). Prior pack retros: MF-0042 and
  MF-0044 RETRO.md are `applied: 2026-11-04 / 2026-11-06`, so nothing to copy into the brief.
- No `pnpm dev` / browser check: no UI code changes; the effect is item wording, shown by `pnpm check:packs` and the
  diff. No `pnpm build` (no UI file touched).
- `pnpm db:sync-keys` twice on the local stack (under the db lock) proves the new content syncs; `pnpm test:db` runs
  in the same hold because DB tests read the packs (MF-0007 SC-1 hashes every item).

## Success Criteria

- [x] SC-1: The pack grandfather set is gone: a fixture pack named `ccdv-f`, `prod-prompting` or
  `platform-foundations` with a 1.20× `origin: ai` key fails `check:packs` (exit 1) and the problem names the id.
  Proof: `src/test/__tests__/mf-0061-key-length-retrofit.acceptance.test.ts` SC-1.
- [x] SC-2: An `origin: official` select-1 question is not length-checked and is counted: a fixture with one 1.20×
  official key prints `key-length: 0 checked, 0 problem(s), 1 skipped (official), 0 multi-select not checked`, exit 0;
  an official question with two correct options still fails (`found 2`). Proof: same file SC-2.
- [x] SC-3: On this repo `pnpm check:packs` exits 0 and prints `key-length: <n ≥ 1> checked, 0 problem(s), 3 skipped
  (official), 5 multi-select not checked` (the 3 official ccdv-f samples; 5 ccdv-f multi-select). Proof: same file
  SC-3 + the `pnpm check:packs` line pasted in LOOP-VERIFY.
- [x] SC-4: The 68 rewritten questions keep their key: for each id, the correct option id equals the literal recorded
  at freeze, there are ≤ 4 options with ids A–D, `select: 1`, and option texts are distinct. Proof: same file SC-4
  (regression lock over a literal id → key map).
- [x] SC-5: Only option `text` and `rationale` fields of the 111 listed questions in 6 packs change (68 first pass, the
  U-6 picks and the U-7 rank moves; lists in scratchpad `mf0061/worklist{,2,3}.json`): no
  other item, no other field (stem, source, level, origin, author, ids, `correct`), no other file under `packs/`; the
  official items are byte-identical. Proof: scope probe (`git show HEAD:<file>` vs worktree, parsed YAML) pasted in evidence.
- [x] SC-6: Each rewrite is grounded in its cited page and adds no new tell: a fresh-context verifier per group writes
  `.planning/tasks/MF-0061/verify/G<n>.md` (item · verdict OK/FIX · claim · page says, quoted · tells); every FIX is
  folded and re-measured; 0 open FIX. `pnpm check:packs` corpus rules (token, leak) report 0 problems. Proof: the five
  tables + check:packs.
- [x] SC-7: The new content syncs: after `pnpm db:reset`, `pnpm db:sync-keys` run twice on the local stack; the second
  run changes nothing; `pnpm test:db` passes. Proof: both outputs pasted in LOOP-VERIFY.
- [x] SC-9 (U-6, contract replaced by U-7): `pnpm check:packs` ranks each `select: 1`, non-official key by length
  among its options (rank = 1 + options strictly longer; ties share the better rank; longest · 2nd longest · 3rd
  longest · shortest) and fails a pack where any rank holds more than 40%:
  `<pack>: key-rank: key is the <rank> option in <k> of <n> single-select questions (<ceil pct>%, limit 40%)`; exactly
  40% passes; the printed share is rounded up so a failure never reads as the limit; packs with fewer than 10 such
  questions are skipped and counted (`key-rank: <n> pack(s) checked, <s> skipped (< 10 questions), 0 problem(s)` on
  this repo). Proof: frozen `src/test/__tests__/mf-0061-longest-key-share.acceptance.test.ts` (re-frozen for U-7) +
  inner `key-length.test.ts`.
- [x] SC-10 (U-6/U-7): The rebalance rewrites are grounded and add no tell: a fresh verifier per group over the new
  rewrites only (`verify/H<n>.md` for U-6, `verify/R<n>.md` for U-7), 0 open FIX; per-pack rank distribution
  before/after in LOOP-VERIFY (aim near-uniform, each rank ≤ ~33%).
- [x] SC-8: Gates: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm gate:planning`, `pnpm gate:workspace` exit 0;
  evidence `.planning/evidence/MF-0061.md` with `## See it yourself`. Proof: receipt in LOOP-VERIFY.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | U-4 says all three packs pass the rule, but 2 ccdv-f hits are verbatim Exam Guide samples (CONTEXT.md: official = verbatim). Exempting `origin: official` from the length comparison is a new exemption in a gate. | orchestrator (U-2) at review | decided without a question (above); flagged in the hand-off |
| C-2 | Removing the slugs turns MF-0044's frozen SC-3 (`prod-prompting` fixture skipped) and SC-6 (`skipped (grandfathered)`) red. Re-freeze: SC-3 becomes "a pack once grandfathered is now checked"; SC-6 regex `skipped \(official\)`. | orchestrator (U-2) / user | resolved: approved by the user 2026-11-07 (U-5) |
| C-3 | Content hashes change for every rewritten question (68 first pass + U-6 + U-7 rebalances, in ccdv-f, prod-prompting, platform-foundations, claude-code-in-action, agent-skills, ai-capabilities; count in LOOP-VERIFY); in-flight attempts on old versions are voided and review approvals on old versions no longer count (MF-0032 / MF-0007). | user | accepted by U-4 (the ticket exists to rewrite them); stated in the hand-off |

## Out of Scope

- Rewriting the official items, or re-fetching the Exam Guide PDF into the corpus.
- Questions that pass the rule (no polishing of non-flagged items).
- Packs with no edits: subagents, team-onboarding-sample (both pass key-length and key-rank). agent-skills,
  ai-capabilities and claude-code-in-action are in scope only for the rank spread (U-6/U-7), not for the pair rule.
- 2-option questions: a pack made of them cannot pass the 40% rank limit (one of two ranks holds ≥ 50%); no shipped pack
  has them (documented at `rankName`; review 3 note 3).
- Multi-select questions (`select > 1`), unchanged by MF-0044.

## Open questions

- None open for the agent; C-1 and C-2 go to the orchestrator's review.

## Iteration Log

<!-- append-only -->
- 2026-11-06 design preflight: `pnpm typecheck` exit 0; `pnpm lint` exit 0 (764 files); `pnpm test` exit 0 (195 files / 1085 tests); `pnpm gate:planning` exit 0 (69 folders); `pnpm gate:workspace` exit 0; `pnpm check:packs` exit 0 (`key-length: 216 checked, 0 problem(s), 156 skipped (grandfathered), 5 multi-select not checked`, corpus copied into the worktree); `pnpm db:reset`, `pnpm db:sync-keys`, `pnpm test:db` not run: need the shared db lock, run once in TEST (SC-7, approved by U-2); `main` CI last 3 runs `success` (660f1c1, dc4e9b2, e60c02a).
- 2026-11-06 proof-case replay: RED — the drafted rule (grandfather set removed, compareLengths on) over the three packs finds 70 hits (ccdv-f 40, prod-prompting 28, platform-foundations 2), 2 of them `origin: official`; worklist in the scratchpad `mf0061/worklist.json`.
- 2026-11-06 · design→plan · RED frozen: `mf-0061-key-length-retrofit.acceptance.test.ts` 3 failed | 1 passed (SC-4 regression lock green by design), identical on a 2nd run. No human checkpoint available in this parallel run: C-1/C-2 decided under U-2/U-4 and flagged for the orchestrator's review.
- 2026-11-06 · plan→build · `pnpm ticket:collisions MF-0061` exit 0: "no unlisted collisions for GRANDFATHERED_PACKS, checkKeyLengths, grandfathered, skippedOfficial, KeyLengthResult across 95 file(s)"; MF-0044 acceptance SC-3/SC-6 listed for re-freeze. Plan approval deferred to the orchestrator's pre-merge review (U-2).
- 2026-11-07 · test→handoff · all 8 SC pass. Drafting: 5 fresh drafters (G2 re-run after an API error and a usage-limit stop); 5 fresh verifiers: 51 OK / 15 NOTE / 2 FIX, both FIX and 7 optional fixes folded, 0 open FIX. `pnpm check:packs` `key-length: 369 checked, 0 problem(s), 3 skipped (official), 5 multi-select not checked`; typecheck 0, lint 0, test 196/1090, test:db 34/181, gate:workspace ok; db:reset + db:sync-keys ×2 under the db lock. MF-0044 acceptance re-frozen (C-2). Reviewer: orchestrator (U-2).

### Iteration 0

```yaml
phase: 0-complete
verdict: PASS
started_at: "2026-11-06"
completed_at: "2026-11-07"
```

**Result:** PASS: all 8 SCs.
**Suggested commit message:** `MF-0061 fix: retrofit key-length tells in ccdv-f, prod-prompting, platform-foundations`
- 2026-11-07 · review (approve) folds: note 4 `ccdv-f.D7.S1.q1` key restores the page's "must never override" qualifier; note 6 `ccdv-f.D6.S3.q2` key + rationale add "or the block limit is reached"; nit 8 GOAL names 3 official items. Finding 1 (key still longest in 42/68) waits on the user.
- 2026-11-07 · U-5/U-6 recorded; stage back to design. proof-case replay: RED — the drafted share rule over the tree flags ccdv-f 51%, prod-prompting 69%, claude-code-in-action 39% (and at HEAD ccdv-f 91%, prod-prompting 87%). SC-9 frozen RED: `mf-0061-longest-key-share.acceptance.test.ts` 4 failed (no rule), identical on a 2nd run. design preflight: `pnpm typecheck` 0, `pnpm lint` 0, `pnpm test` 196/1090, `pnpm gate:planning` ok, `pnpm gate:workspace` ok, `pnpm check:packs` 0 (before the rule), `pnpm test:db` 34/181 and `pnpm db:reset` + `pnpm db:sync-keys` run 2026-11-07 (re-run in TEST under the db lock).
- 2026-11-07 · design→build · rule implemented (`longestKeyShareProblem`, `keyLongest`), inner tests green; repo run RED as expected: `ccdv-f: longest-key: key is the strictly longest option in 23 of 45 single-select questions (51%, limit 35%)`, `claude-code-in-action: … 26 of 66 … (39%…)`, `prod-prompting: … 37 of 54 … (69%…)`. 4 rebalance drafters H1–H4 next.
- 2026-11-07 · test→handoff (U-6) · all 10 SC pass. Rebalance H1–H4 (46 items), 4 fresh verifiers 35 OK / 7 NOTE / 4 FIX, all folded. Longest-key share: ccdv-f 11/45, prod-prompting 13/54, claude-code-in-action 16/66 (all 24%). `pnpm check:packs` `longest-key: 7 pack(s) checked, 0 problem(s)`; typecheck 0, lint 0, test 197/1097, test:db 34/181, gate:workspace ok; db:reset + db:sync-keys ×2 identical under the db lock.

### Iteration 0 (U-6 addendum)

```yaml
phase: 0-complete
verdict: PASS
started_at: "2026-11-07"
completed_at: "2026-11-07"
```

**Result:** PASS: SC-1…SC-10.
**Suggested commit message:** `MF-0061 fix: retrofit key-length tells and cap the longest-key share at 35% per pack`
- 2026-11-07 · U-7 recorded; proof-case replay: RED — rank probe flags agent-skills (shortest 54%), ai-capabilities (2nd 50%), ccdv-f (2nd 44%), prod-prompting (2nd 67%). SC-9 re-frozen for U-7 (history entry), RED against the U-6 code: 5 failed, identical on a 2nd run. Rank rule implemented (`keyRankProblems`, `keyRanks`, `KEY_RANK_LIMIT`, `KEY_RANK_MIN_QUESTIONS`), inner tests green; delta notes 2 (ceil) and 7 (test asserts `checked`) fixed. 5 rank drafters R1–R5 running.
- 2026-11-07 · test→handoff (U-7) · all 10 SC pass. R1–R5 changed 64 questions (agent-skills 12, ai-capabilities 10, ccdv-f 17, prod-prompting 25); 5 fresh verifiers 57 OK / 4 NOTE / 3 FIX, all folded. Rank spread (longest/2nd/3rd/shortest): agent-skills 12/14/11/17, ai-capabilities 11/14/15/8, ccdv-f 10/11/14/10, prod-prompting 14/16/14/10; every pack ≤ 36%. 111 distinct questions changed in 6 packs. `pnpm check:packs` `key-rank: 7 pack(s) checked, 0 skipped (< 10 questions), 0 problem(s)`; typecheck 0, lint 0, test 197/1098, test:db 34/181, gate:workspace ok; db:reset + db:sync-keys ×2 identical under the db lock.

### Iteration 0 (U-7 addendum)

```yaml
phase: 0-complete
verdict: PASS
started_at: "2026-11-07"
completed_at: "2026-11-07"
```

**Result:** PASS: SC-1…SC-10.
**Suggested commit message:** `MF-0061 fix: retrofit key-length tells and add a per-pack key-rank spread rule`
- 2026-11-07 · review 3 (approve) folds started: note 3 rank names (`rankName`, 'shortest' only for the real last rank; inner tests for 2/3/5-option), nit 5 GOAL counts; finding 1 filler rewrite by drafter F1 + fresh verifier.
- 2026-11-07 · test→handoff (review 3 folds) · finding 1 filler rewrite (F1, 9 questions / 15 options, ranks unchanged; verifier 15 OK / 0 FIX), note 3 rank names for 2–6 options, nit 5 GOAL counts. check:packs 0, test 197/1100, typecheck/lint/gates ok, scope 0 violations; SC-7 not re-run (no key changed).
