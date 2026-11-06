---
phase: 0-planning
ticket_id: MF-0044
status: executing
verdict: IN_PROGRESS
started_at: "2026-11-06"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 0

## Discovery summary

- Precedent: MF-0041 `scripts/lib/cuckoo-flaw-key.mjs` (pure, YAML in, problems out) called from
  `scripts/check-pack-grounding.mjs:38-52` before the corpus early exit. Same shape here.
- `checkItemFile` (`scripts/lib/item-grounding.mjs:118`) already reports a YAML parse error with corpus present; the
  key-length rule reports its own, so CI (no corpus) still fails closed.
- Problem objects across the libs carry `{ file, rule, message }` (`GroundingProblem`); the script prints `message`.
- Gates on the touched paths: `pnpm lint` (biome over `scripts/**`), `pnpm typecheck` (JSDoc in `.mjs`), the frozen
  mf-0041 SC-5 run of the script (fixture has no `questions/`; unaffected).

## Symbols changed

None. The script gains a rule and a summary clause; no existing function, set or shared type changes.

## Frozen files this will re-freeze

None. Only `src/test/__tests__/mf-0041-flaw-key.acceptance.test.ts` runs the script (SC-5): a cuckoo-only fixture,
asserting `status 1` and two stderr strings; the key-length rule finds no `questions/` there and adds no problem.
No acceptance test asserts the `check:packs:` summary text (grep over `*.acceptance.test.*`).

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1, SC-2, SC-3, SC-4 | 1, 2 | frozen file + inner tests of the lib |
| SC-5 | 2 | `pnpm check:packs` with `.cache/corpus` moved aside, then restored; review of call order |
| SC-6 | 2 | frozen SC-6 case + `pnpm check:packs` exit 0 |
| SC-7 | all | receipt |

## Steps

1. `scripts/lib/key-length.mjs` (new, pure):
   - `KEY_LENGTH_LIMIT = 1.15` with the reason (MF-0042 verifier findings; user C-2).
   - `GRANDFATHERED_PACKS = new Set(["ccdv-f", "prod-prompting", "platform-foundations"])` (user C-3; MF-0059 removes).
   - `checkKeyLengths({ file, pack, text })` → `{ problems, checked, grandfathered, multi }`. YAML parse error →
     one problem `<file>: key-length: cannot parse YAML: <reason>`; a missing `questions` list → problem; per item:
     `select !== 1` → `multi++`; grandfathered pack → `grandfathered++` (still counted, not checked); exactly one
     `correct: true` and ≥ 1 distractor else `<file>: <id>: select: 1 needs exactly one correct option, found <n>`
     (0 distractors: `… needs at least one distractor`); ratio `key.length / max(distractor.length)`; `>= limit` →
     `<file>: <id>: key is <k> chars, longest distractor <d> (<ratio.toFixed(2)>×, limit 1.15×)`.
   - Fail closed: an item that is not a map, or option text that is not a string, is a problem naming the id/index.
2. `scripts/check-pack-grounding.mjs`: a `questionFiles()` walk (PACKS/<pack>/questions/*.yaml); run the rule next to
   the flaw-key rule, before the corpus exit; add `key-length: <checked> checked, <n> problem(s), <g> skipped
   (grandfathered), <m> multi-select not checked` to both summary lines (corpus-absent and full). Header comment.
3. `src/test/__tests__/key-length.test.ts`: inner tests per decision (boundary 1.1499 / 1.15, grandfathered, multi,
   key count 0/2, no distractor, non-map item, non-string text, parse error).

## Riskiest step

A false clean, the dangerous direction for a gate (verification.md §4): a question the rule silently skips. Every
non-`select: 1` path is counted in the summary, and every malformed path is a problem (SC-4 + inner tests). Second:
running after the corpus exit would make CI skip the rule: SC-5 runs the script with the corpus moved aside.

## Rejected options

- Words instead of characters: user chose characters (C-2).
- Reading the grandfather set from config/env: one consumer, removed by MF-0059; a constant with a reason is enough.
- Folding into `item-grounding.mjs`: that lib is corpus-bound and skips uncached items; this rule must not skip.

## Verify

- `pnpm typecheck && pnpm lint && pnpm test && pnpm gate:planning && pnpm check:packs`; SC-5 corpus-absent run.
- No browser (nothing on screen). Show-it command: `pnpm check:packs`.
- Fresh-context `diff-reviewer` (high-risk).

## Tasks

```json tasks
[
  { "id": "T1", "title": "key-length lib + inner tests", "agent": "inline",
    "owns": ["scripts/lib/key-length.mjs", "src/test/__tests__/key-length.test.ts"],
    "depends_on": [], "closes": [],
    "done_when": ["pnpm vitest run src/test/__tests__/key-length.test.ts", "pnpm typecheck"],
    "context": ["skill:testing-strategy"] },
  { "id": "T2", "title": "wire into check:packs", "agent": "inline",
    "owns": ["scripts/check-pack-grounding.mjs"],
    "depends_on": ["T1"], "closes": ["SC-1", "SC-2", "SC-3", "SC-4", "SC-5", "SC-6"],
    "done_when": ["pnpm vitest run src/test/__tests__/mf-0044-key-length.acceptance.test.ts src/test/__tests__/mf-0041-flaw-key.acceptance.test.ts", "pnpm check:packs"],
    "context": [] },
  { "id": "T3", "title": "verify + review", "agent": "inline",
    "owns": [".planning/tasks/MF-0044/**", ".planning/evidence/MF-0044.md"],
    "depends_on": ["T2"], "closes": ["SC-7"],
    "done_when": ["pnpm typecheck && pnpm lint && pnpm test && pnpm gate:planning"],
    "context": ["agent:diff-reviewer"] }
]
```
