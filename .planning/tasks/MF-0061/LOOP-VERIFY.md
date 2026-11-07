---
phase: 0-verification
ticket_id: MF-0061
status: complete
verdict: PASS
started_at: "2026-11-06"
completed_at: "2026-11-07"
resume_with: /gsd-goal-loop
---

# Verification — Iteration 0

## Baseline (2026-11-06, before any change, tree 660f1c1)

`pnpm typecheck` 0 · `pnpm lint` 0 (764 files) · `pnpm test` 195 files / 1085 passed · `pnpm gate:planning` ok (69) ·
`pnpm gate:workspace` ok · `pnpm check:packs` 0 (`key-length: 216 checked, 0 problem(s), 156 skipped (grandfathered),
5 multi-select not checked`) · `main` CI last 3 `success`.

## RED at freeze (Stage 2b)

| SC | Acceptance test | Red reason at freeze (pasted) |
|----|-----------------|-------------------------------|
| SC-1 | `mf-0061-key-length-retrofit.acceptance.test.ts` | `AssertionError: expected +0 to be 1` — the three packs were still grandfathered, a 1.20× key exited 0 |
| SC-2 | same | `AssertionError: expected 1 to be +0` — an official 1.20× key was length-checked and failed |
| SC-3 | same | `expected 'check:packs: 7 cuckoo file(s), 1 path…' to match /key-length: … 3 skipped \(official\)…/` |
| SC-4 | same | green at freeze by design (regression lock over the 68 keys recorded at 660f1c1) |

3 failed | 1 passed, identical on a 2nd run. The first draft also failed SC-2 for a wrong reason (the shipped
`paths/` name packs a fixture lacks, exit 1); fixed before freezing by giving fixture runs an empty `MF_PATHS_DIR`.

## Re-freeze of MF-0044 (C-2)

`src/test/__tests__/mf-0044-key-length.acceptance.test.ts` `a80b26e5…` → `87ffbf84…`, history entry in
`.planning/tasks/MF-0044/FROZEN.json`: SC-3 (prod-prompting fixture now checked: `1 checked, 1 problem(s), 0 skipped
(official)`), SC-6 regex `skipped \(official\)`, header comment. SC-1, SC-2, SC-4 byte-identical. Approval: orchestrator
(U-2) at review.

## Review 3 folds (2026-11-07, approve)

- Finding 1 (filler): drafter F1 reworded 15 options in 9 questions (ccdv-f D6.S1.q1, D2.S3.q1, D5.S4.q1, D6.S3.q2,
  D8.S2.q1, D8.S3.q1, D8.S3.q2, D1.S3.q1; prod-prompting D3.S3.q2) so the length carries a page-refuted claim; no key
  rank moved. Fresh verifier `verify/F1.md`: 15 OK, 3 NOTE, 0 FIX; NOTE 1 applied (D6.S1.q1 D absolute removed).
  Must-keeps intact (D6.S3.q2 "or the block limit is reached", D8.S2.q1 "ideally").
- Note 3: `rankName(rank, optionCount)`; "shortest" only for the real last rank; ranks counted by name; inner tests
  for 2-, 3-, 5- and 6-option naming and bucketing. 2-option packs cannot pass 40% (documented; none shipped). No
  frozen file changed (4-option messages are identical).
- Nit 5: GOAL SC-5 / Affected / Out of Scope now say 111 questions in 6 packs.
- Re-run: `pnpm check:packs` 0 (`key-rank: 7 pack(s) checked, 0 skipped (< 10 questions), 0 problem(s)`), unit +
  acceptance 31/31, `pnpm test` 197 files / 1100 passed, typecheck 0, lint 0, gate:planning ok, gate:workspace ok,
  scope `55 file(s) changed, 111 of 111 listed items changed, 399 text/rationale field(s) changed, 0 violation(s)`.
  SC-7 not re-run: no answer key changed (scope probe: no `correct` flag moved; frozen SC-4 green).

## RED at freeze, U-7 (SC-9 re-frozen)

`mf-0061-longest-key-share.acceptance.test.ts` `c44c4aa3…` → `dedda698…` (history entry citing U-7). RED against the U-6
code, identical on a 2nd run (5 failed): rank-2 5/10 pack `expected +0 to be 1`; shortest/tied packs `expected +0 to be
1`; exactly-40% pack fails the old 35% cap `expected 1 to be +0`; 9-question pack fails (no minimum sample) `expected 1 to
be +0`; repo stdout lacks `/key-rank: … 0 problem(s)/`. With the rank rule in, before the U-7 rewrites, the repo was RED
with `ccdv-f: key-rank: key is the 2nd longest option in 20 of 45 single-select questions (45%, limit 40%)` (the other
three failing packs had already been rebalanced by the drafters when the rule landed; the probe below shows them).

## Key length-rank distribution per pack (U-7; longest / 2nd / 3rd / shortest; select 1, non-official, ties share the better rank)

| Pack | HEAD 660f1c1 | before U-7 (after U-6) | after U-7 |
|---|---|---|---|
| agent-skills | 0 / 14 / 11 / 29 (54%) | 0 / 14 / 11 / 29 | **12 / 14 / 11 / 17** (max 31%) |
| ai-capabilities | 3 / 24 / 15 / 6 (50%) | 3 / 24 / 15 / 6 | **11 / 14 / 15 / 8** (max 31%) |
| ccdv-f | 42 / 2 / 0 / 1 (93%) | 17 / 20 / 6 / 2 (44%) | **10 / 11 / 14 / 10** (max 31%) |
| prod-prompting | 49 / 4 / 1 / 0 (91%) | 15 / 36 / 3 / 0 (67%) | **14 / 16 / 14 / 10** (max 30%) |
| claude-code-in-action | 34 / 6 / 9 / 17 (52%) | 24 / 16 / 9 / 17 | 24 / 16 / 9 / 17 (max 36%) |
| platform-foundations | 14 / 19 / 10 / 11 | 12 / 19 / 12 / 11 | 12 / 19 / 12 / 11 (max 35%) |
| subagents | 9 / 12 / 13 / 14 | same | 9 / 12 / 13 / 14 (max 29%) |

## Rank rebalance verification (SC-10, U-7)

5 fresh drafters (R1–R5) moved keys between ranks by rewording (cutting filler, tightening keys without dropping
qualifiers, or lengthening distractors with grounded wording) and fixed delta notes 4 and 5; 5 fresh verifiers over the
new edits only (diff against a pre-U-7 snapshot).

| Group | Questions changed | OK | NOTE | FIX | Folded |
|---|---|---|---|---|---|
| R1 agent-skills | 12 | 11 | 1 | 0 | none |
| R2 ai-capabilities | 10 | 8 | 1 | 1 | FIX D3.S2.q5 A (absolute "cannot" only in a distractor) |
| R3 ccdv-f | 17 | 16 | 0 | 1 | FIX D6.S3.q2 key (must-keep "or the block limit is reached" restored); optional D5.S3.q2 key person |
| R4 prod-prompting D1 | 11 | 9 | 2 | 0 | optional D1.S2.q6 D (Opus and Sonnet 4.6, as the page says) |
| R5 prod-prompting D2–D3 | 14 | 13 | 0 | 1 | FIX D3.S2.q1 A/D (unsupported "five minutes", "months after cutoff") |

0 open FIX. Must-keeps re-checked by R3: D7.S1.q1 "must never override", D8.S2.q1 "ideally", D6.S3.q2 "block limit".

## RED at freeze, U-6 (SC-9, superseded by U-7)

| SC | Acceptance test | Red reason at freeze (pasted) |
|----|-----------------|-------------------------------|
| SC-9 | `mf-0061-longest-key-share.acceptance.test.ts` | `AssertionError: expected +0 to be 1` (no rule: a 2-of-3 longest-key pack exits 0); stdout lacks `longest-key: 1 pack(s) checked, 0 problem(s)` (×2); repo stdout does not match `/longest-key: … 0 problem\(s\)/`. 4 failed, identical on a 2nd run |

After the rule, before the rebalance, the real repo was RED for the right reason:
`ccdv-f: longest-key: key is the strictly longest option in 23 of 45 single-select questions (51%, limit 35%)`,
`claude-code-in-action: … 26 of 66 … (39%, limit 35%)`, `prod-prompting: … 37 of 54 … (69%, limit 35%)`.

## Longest-key share per pack (U-6, superseded by the U-7 rank rule; select 1, excluding official; key strictly longer than every distractor)

| Pack | HEAD 660f1c1 | after first pass | after rebalance |
|---|---|---|---|
| ccdv-f | 41/45 (91%) | 23/45 (51%) | **11/45 (24%)** |
| prod-prompting | 47/54 (87%) | 37/54 (69%) | **13/54 (24%)** |
| claude-code-in-action | 26/66 (39%) | 26/66 (39%) | **16/66 (24%)** |
| platform-foundations | 14/54 (26%) | 12/54 (22%) | 12/54 (22%) |
| subagents | 6/48 (13%) | 6/48 | 6/48 (13%) |
| agent-skills | 0/54 | 0/54 | 0/54 — key never longest (opposite tell, finding only) |
| ai-capabilities | 0/48 | 0/48 | 0/48 — key never longest (opposite tell, finding only) |

## Rebalance verification (SC-10)

4 fresh drafters (H1–H4, 46 items: ccdv-f 12, prod-prompting 24, claude-code-in-action 10), each lengthening one
distractor; then 4 fresh verifiers over the new edits only (diff against a pre-rebalance snapshot).

| Group | Items | OK | NOTE | FIX | Folded |
|---|---|---|---|---|---|
| H1 ccdv-f | 12 | 9 | 2 | 1 | FIX D6.S2.q1 C rationale (borrowed tool-overtriggering reason) |
| H2 prod-prompting D1 | 14 | 10 | 1 | 3 | FIX D1.S1.q4 D, D1.S1.q5 C ("even" tells), D1.S3.q3 A (remedy made partly true) |
| H3 prod-prompting D2–D3 | 10 | 8 | 2 | 0 | optional D3.S1.q5 C rationale clause |
| H4 claude-code-in-action | 10 | 8 | 2 | 0 | none |

0 open FIX.

## Content verification (SC-6)

5 fresh-context drafters (G1–G5; G2 re-run twice after an API error and a usage-limit stop, the first run wrote
nothing), then 5 fresh-context verifiers, none of which read the grounding notes before its verdicts.

| Group | Items | OK | NOTE | FIX | Folded |
|---|---|---|---|---|---|
| G1 ccdv-f D1–D2 | 15 | 11 | 4 | 0 | 2 optional rationales (D2.S4.q1 B, D2.S1.q2 C) |
| G2 ccdv-f D4–D6 | 13 | 10 | 3 | 0 | 1 optional rationale (D6.S1.q2 B) |
| G3 ccdv-f D7–D8 | 10 | 6 | 4 | 0 | D8.S2.q1 key ("ideally" OAuth restored), D8.S3.q2 B |
| G4 prod-prompting D1 | 15 | 12 | 2 | 1 | FIX D1.S3.q5 A rationale; D1.S1.q4 B |
| G5 prod-prompting D2–D3 + pf | 15 | 12 | 2 | 1 | FIX D3.S3.q5 A ("default two retries" not on page); pf D1.S1.q4 A |

0 open FIX. Remaining NOTEs are recorded in `verify/G<n>.md` (indirect refutations; pre-existing weak grounding in
ccdv-f D2.S6.q2 and D2.S2.q2, unchanged in kind by this ticket).

## Success Criteria

| SC | Verdict | Evidence |
|----|---------|----------|
| SC-1 | PASS | frozen SC-1: each of `ccdv-f.S1.q1`, `prod-prompting.S1.q1`, `platform-foundations.S1.q1` → `key is 120 chars, longest distractor 100 (1.20×, limit 1.15×)`, exit 1 |
| SC-2 | PASS | frozen SC-2: `key-length: 0 checked, 0 problem(s), 1 skipped (official), 0 multi-select not checked`; two-key official → `found 2` |
| SC-3 | PASS | `pnpm check:packs` exit 0: `key-length: 369 checked, 0 problem(s), 3 skipped (official), 5 multi-select not checked; key-rank: 7 pack(s) checked, 0 skipped (< 10 questions), 0 problem(s)` |
| SC-4 | PASS | frozen SC-4: 68 keys unchanged, ≤ 4 distinct options A–D, select 1 |
| SC-5 | PASS | scope probe: `scope: 55 file(s) changed, 111 of 111 listed items changed, 399 text/rationale field(s) changed, 0 violation(s)` (111 distinct questions in 6 packs: ccdv-f 38, prod-prompting 39, agent-skills 12, ai-capabilities 10, claude-code-in-action 10, platform-foundations 2); the 3 official items `byte-identical (not in diff)` |
| SC-6 | PASS | table above; `pnpm check:packs` token/leak `0 problem(s)` (485 items checked) |
| SC-7 | PASS | DB section (re-run after U-7): reset, sync ×2 identical, test:db 34 files / 181 passed |
| SC-8 | PASS | receipt below |
| SC-9 | PASS | frozen `mf-0061-longest-key-share.acceptance.test.ts` (re-frozen U-7) 5/5; inner `key-length.test.ts` 15/15; repo `key-rank: 7 pack(s) checked, 0 skipped (< 10 questions), 0 problem(s)` |
| SC-10 | PASS | U-6 (H1–H4) and U-7 (R1–R5) tables above, 0 open FIX; every rank ≤ 36% in every pack |

## Gates and suite (2026-11-07, after U-7, content final)

`pnpm typecheck` 0 · `pnpm lint` 0 (766 files) · `pnpm test` 197 files / 1100 passed · `pnpm gate:workspace` ok ·
`pnpm gate:planning` ok · `pnpm check:packs` 0 · MF-0060 plan-owns self-check ok.

## DB (SC-7)

Re-run after U-7 (2026-11-07, db lock held 10:58Z and released): `pnpm db:reset` 0, `pnpm db:sync-keys` ×2 exit 0 with identical
output (incl. `agent-skills: 54 key(s) synced`, `ai-capabilities: 48 key(s) synced`), `pnpm test:db` `Test Files 34 passed (34)`,
`Tests 181 passed (181)`. Earlier run after U-6:

Re-run after U-6 (2026-11-07, db lock held and released): `pnpm db:reset` 0, `pnpm db:sync-keys` ×2 exit 0 with identical
output (now also `claude-code-in-action: 66 key(s) synced`, `88 item(s) registered`), `pnpm test:db` `Test Files 34 passed
(34)`, `Tests 181 passed (181)`. First run (before U-6):


Under the db lock (2026-11-07, held 09:56Z, released after): `pnpm db:reset` exit 0 (it runs the sync once itself),
then `pnpm db:sync-keys` ×2, both exit 0, output identical (`diff` empty): `ccdv-f: 67 key(s) synced`, `ccdv-f: 70
item(s) registered`, `platform-foundations: 54 key(s) synced`, `73 item(s) registered`, `prod-prompting: 54 key(s)
synced`, `72 item(s) registered`. The script prints totals, not a change count, so "the second run changes nothing" is
shown as identical output over an idempotent upsert, not as a counted zero. `pnpm test:db` exit 0: `Test Files 34
passed (34)`, `Tests 181 passed (181)`.

## Not verified

- The U-6 opposite tell (key never longest in agent-skills/ai-capabilities) is now enforced by the U-7 rank rule (all ranks ≤ 40%).
- No browser check: no UI code changed (item wording only). Show-it command: `pnpm check:packs`.
- Plan approval for a high-risk ticket and the re-freeze of MF-0044's acceptance file were decided under U-2/U-4
  without a live checkpoint; the orchestrator's diff review is the approval point.
- NOTE-level items (15) are judged acceptable by the verifiers, not proven by a page sentence each.

## Verdict: PASS
