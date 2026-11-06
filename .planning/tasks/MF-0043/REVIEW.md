---
verdict: approve
reviewed_hash: d6db22673b04633fa7e5c4eaaeff984418e6b1570e39e391b8ae5126490b265d
reviewed_at: 2026-11-06T09:07:11Z
---
<!-- Round 3. reviewed_hash = sha256 of `git diff HEAD` (tracked: package.json, SKILL.md, templates.md,
MF-0043/GOAL.md). Untracked files reviewed, sha256:
  scripts/lib/frozen-collisions.mjs                                 b1c4a6baed86b95f87eb953ec3e2c15e27a494aaa8069b74029c8cd6e2ec597e
  scripts/frozen-collisions.mjs                                     0a11fa1349ba3a1403dac3760f3498b5c2affd7ea03439b078ebcfe2f08560b7
  src/test/__tests__/frozen-collisions.test.ts                      b2607cb5c37fe070a80c71e453288aceed7f006eb3342d3329141fd6a179e0b9
  src/test/__tests__/mf-0043-frozen-collisions.acceptance.test.ts   95773a9b71167334b3821192fce803654fc0fec653fff9b7eb602763e7ed9ad1 (= FROZEN.json, unedited)
  .planning/tasks/MF-0043/{FROZEN.json,LOOP-PLAN.md,LOOP-VERIFY.md}
No ticket:verify script exists, so there is no receipts diff_hash to bind to. -->

## What was run (round 3)

- Both MF-0043 test files: 26/26 pass. `biome check` on the changed lib and test files: clean.
  `pnpm ticket:collisions MF-0043`: exit 0.
- `parseSymbols` probes:
  - Rejected (exit 2): `` `Promise<PackContent>` ``, `` `MAP[Key]` ``, `` `f(a) and g(b)` `` and
    `` `f(g(x))` ``.
  - Kept: `` `ITEM_TYPES[number]` `` → `ITEM_TYPES`, `` `ROWS[0]` `` → `ROWS`,
    `` `toPlayableQuestion(q)` `` → `toPlayableQuestion`.
  - `### Functions` under `## Symbols changed` stays inside the section.
- `parseListedPaths("## Frozen files…\n\nNone.\n\n### Steps\n\n- `path`")` → `[]`. The re-freeze section ends at any
  heading again, so an ambiguous layout over-reports.
- The unfilled templates.md placeholder still holds rejected tokens (`` `Promise<Type>` ``,
  `` `pnpm ticket:collisions <ID>` ``), so it exits 2.
- Earlier rounds: the real-CLI replay on `git archive da583a0` gave RED `mf-0008-schema…:10` and `:70` with exit 1.
  With the MF-0008 row listed it gives exit 0 (the coordinator reports the same on the fresh lib).

## Status of earlier findings

- Round 1: B1 (silent drop), B2 (subheading truncation) and B3 (literals) are fixed, as are the own-exclusion,
  trigger and per-file-listing minors.
- Round 2: the blocking generic `T<U>` case is fixed (rejected with a message that says to list the inner type).
  The greedy call form and the re-freeze section running over subheadings are both fixed.

## Findings

- [note] scripts/lib/frozen-collisions.mjs:20 — `` `LABEL["not-in-pack"]` `` → `LABEL` only, so the quoted index
  literal is not searched. This is the same "outer name hides inner" shape as the generic case, but here the outer
  name is the map that changes, and a member the author means to change would be listed on its own (SKILL.md tells
  them to list sibling members as literals). Not blocking. If wanted, reject a quoted index the way `MAP[Key]` is
  rejected.
- [note] LOOP-VERIFY.md still needs the SC-6/7/8 receipts and the da583a0 replay line (the coordinator owns them).
  SC-6 on its own exercises no scan, because MF-0043 says "None.".
