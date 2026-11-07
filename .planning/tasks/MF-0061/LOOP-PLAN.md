---
phase: 0-planning
ticket_id: MF-0061
status: executing
verdict: IN_PROGRESS
started_at: "2026-11-06"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 0

## Discovery summary

- The rule: `scripts/lib/key-length.mjs` (MF-0044). `GRANDFATHERED_PACKS` (line 18) feeds `compareLengths:
  !isGrandfathered` (line 137); structure checks run first, so a skipped comparison never skips validation (MF-0044
  review minor 1). Summary built in `scripts/check-pack-grounding.mjs:74`, printed on both the corpus-absent and full
  lines.
- Tests on the rule: `src/test/__tests__/key-length.test.ts` (inner, not frozen; 3 cases name the set or a
  grandfathered pack) and `src/test/__tests__/mf-0044-key-length.acceptance.test.ts` (frozen, MF-0044; SC-3 and SC-6
  assert the grandfather set).
- Content: 68 `origin: ai` items in 3 packs (list: scratchpad `mf0061/worklist.json`, reproduced per group below), each
  citing one `source.url` cached in `.cache/corpus/<sha256(url)>.json` (`.text`). Precedent for the verify tables:
  `.planning/tasks/MF-0042/verify/G1.md` (item · verdict · finding, lengths measured from parsed YAML).
- Other rules the rewritten text passes through in `check:packs`: `item-grounding.mjs` token rule (backticked or
  snake_case tokens in a rationale must occur in the cited page or in the stem/options) and leak rule (product-surface
  terms like `claude.ai`, `Claude Code`, `Messages API`, `Projects` in any text must occur in the cited page).
- Pack acceptance tests that keep holding: mf-0031 SC-5 / mf-0038 SC-4 (4 distinct options, select 1, ≤ 40% per key
  letter: keys unchanged, so unchanged), mf-0006 SC-3 (3 official), mf-0003 (official keys B).

## Symbols changed

- `GRANDFATHERED_PACKS` (removed from scripts/lib/key-length.mjs).
- `checkKeyLengths` (result field `grandfathered` renamed `skippedOfficial`; skips the comparison for origin official).
- `KeyLengthResult` (same field rename; U-6 adds `keyLongest`).
- `questionProblem` (renamed `questionVerdict`, returns the problem plus the key's length rank; module-private).
- `keyLongest` / `longestKeyShareProblem` / `LONGEST_KEY_SHARE_LIMIT` (U-6, replaced by U-7 `keyRanks` / `keyRankProblems`).

## Frozen files this will re-freeze

| File:line | Change (new expected value) | Reason |
|---|---|---|
| `src/test/__tests__/mf-0044-key-length.acceptance.test.ts:100-112` (SC-3) | `prod-prompting` 150-char fixture → now a problem: `prod-prompting.S1.q1: key is 150 chars, longest distractor 100 (1.50×, limit 1.15×)`, summary `key-length: 1 checked, 1 problem(s), 0 skipped (official), 0 multi-select not checked` | U-4 / MF-0044 C-3: the grandfather set is removed by this ticket |
| `src/test/__tests__/mf-0044-key-length.acceptance.test.ts:153-159` (SC-6) | regex `skipped \(grandfathered\)` → `skipped \(official\)` | same; the skip counter now counts official items (C-1) |
| `src/test/__tests__/mf-0044-key-length.acceptance.test.ts:3` (header) | "skips the grandfathered packs" → "(grandfather set removed by MF-0061)" | wording only |

Every other assertion in that file was read: SC-1 (`fixture.S1.q1` 1.20×, exit 1), SC-2 (`toContain("key-length: 1
checked, 0 problem(s)")`, the 1.15× boundary message), SC-4 (two keys / no key / bad YAML / `1 multi-select not
checked`) still hold: a `fixture` pack was never grandfathered, and the summary keeps the prefix `key-length: <n>
checked, <n> problem(s), `. `ticket:collisions` output is pasted in the Iteration Log.

## Parsers

- `origin` read for the exemption: exactly the string `official` skips the comparison; any other value (including
  missing) is compared. The structure checks (options list, text/correct types, exactly one key, ≥ 1 distractor,
  non-empty distractor) run before the skip, so an official item with two keys fails (frozen SC-2). Inner tests: an
  `origin: "Official"` / missing origin with a 1.20× key is a problem (no case-folding: the loader's enum is
  lower-case, `src/engine/content/origin.ts:4`).

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1, SC-2 | 1, 2, 3 | frozen `mf-0061-key-length-retrofit.acceptance.test.ts` + inner `key-length.test.ts` |
| SC-3, SC-4 | 4, 5, 6 | same frozen file (repo run + key map) + `pnpm check:packs` |
| SC-5 | 4, 6 | scope probe (scratchpad `mf0061/scope.mjs`), output in evidence |
| SC-6 | 4, 5, 6 | `verify/G1..G5.md`, `pnpm check:packs` 0 problems |
| SC-7 | 7 | `pnpm db:reset`, `pnpm db:sync-keys` ×2, `pnpm test:db` under the db lock |
| SC-8 | 8 | receipt |

## Steps

1. `scripts/lib/key-length.mjs`: delete `GRANDFATHERED_PACKS`; `compareLengths = item.origin !== "official"`; result
   field `skippedOfficial` (counted when skipped); doc comments name MF-0061 and CONTEXT.md (official = verbatim).
2. `scripts/check-pack-grounding.mjs`: summary `… <n> skipped (official), …`; header comment.
3. `src/test/__tests__/key-length.test.ts`: replace the set test with "no pack is exempt: ccdv-f is checked"; official
   skip counted; official malformed still fails; `Official` / missing origin compared. Re-freeze MF-0044's file per
   the table above (history entry with old hash and reason).
4. Content: 5 fresh-context drafters (groups below, disjoint files) rewrite option text/rationale per the brief.
5. 5 fresh-context verifiers (one per group, not the drafter) write `verify/G<n>.md`.
6. Fold every FIX (orchestrator), re-measure, `pnpm check:packs`.
7. DB proof under the lock.
8. Gates, LOOP-VERIFY, evidence, hand-off.

## Riskiest step

The content rewrites: 68 hand-edited items where a lengthened distractor can become partially true (a second correct
answer) or a tightened key can drop the qualifier that made it right. The frozen SC-4 only proves the key id; the
proof of meaning is the fresh verifier per group reading each option against the cited page (SC-6), plus the scope
probe (SC-5) proving nothing outside option text/rationale moved. Second: the gate edit is a false-clean risk (an item
silently skipped): the exemption keys on `origin === "official"` only, after every structure check, and the summary
counts it (3 on this repo, asserted by frozen SC-3).

Versioned content: every rewritten item gets a new content hash; `record_attempt` refuses an attempt bound to the old
hash (MF-0032) and reviews bind to the version read (MF-0007). This ticket writes no judgement; it changes the content
those judgements bind to, which is the designed behaviour (C-3).

Re-run state: `pnpm db:sync-keys` is idempotent (upsert + delete of keys no longer in files); the second run must
report no change. It owns no manifest ids.

## Rejected options

- Rewrite the 2 official items: breaks CONTEXT.md (official = verbatim) — C-1.
- Relabel them `origin: ai`: breaks `mf-0003-questions` and `mf-0006-content` SC-3 (3 official) and loses the golden set.
- Keep `GRANDFATHERED_PACKS` as an empty set: dead allowlist; YAGNI.
- One ticket per pack: user decided U-4.
- Shorten every key only: some keys carry the qualifier that makes them right (drafter check 1); lengthening a
  distractor with a grounded wrong detail is often safer.

## Drafting brief (each drafter gets this section and its group list)

You rewrite only the questions in your group list, only their option `text` and, where the text change needs it,
that option's `rationale`. Never change ids, `correct`, `select`, stem, `source`, `level`, `origin`, `author`, other
questions, or other files. Write only to your group's YAML files and `.planning/tasks/MF-0061/grounding/G<n>.md`.

1. **Target length.** Characters = code points of the text, trailing whitespace trimmed (the rule's `charCount`).
   After your edit: key / longest distractor **≤ 1.08** (hard limit 1.15), and the key is not the shortest option by
   more than 25%. Best: the four options within ±15% of each other. Measure with
   `node -e` over the parsed YAML, never by eye.
2. **How.** Prefer lengthening distractors with a plausible-but-wrong detail that the cited page refutes, or that the
   page shows belongs to a different situation. Tighten the key only by removing words that carry no part of why it
   is right; keep every qualifier that makes it right.
3. **Grounding.** Read the cited page: `.cache/corpus/<sha256(source.url)>.json`, field `.text` (compute the hash with
   `node -e 'console.log(require("crypto").createHash("sha256").update(URL).digest("hex"))'`). Every factual clause you
   add must be supported (key) or refuted (distractor) by that page. No facts from memory, no facts from a sibling
   page. A rationale gives the page's own reason, not a plausible one.
4. **The four checks.** (a) For a security, safety or permission statement, keep the page's strictest rule and its
   qualifier; never soften it. (b) For any "always", "by default", "is loaded", grep the page for the flag or mode
   that removes it and scope the claim. (c) n/a (no diagrams). (d) Rationale = the page's reason.
5. **No new tells.** No absolute words ("always", "never", "only", "all") added to distractors alone; no grammar or
   number mismatch with the stem; no distractor made partially true (if a careful reader could defend it from the
   page, it is a second key — rewrite); do not echo the stem's wording in the key only; keep parallel structure across
   options.
6. **No copying.** No run of 12 or more consecutive words copied from the page into an option.
7. **YAML.** Keep the existing quoting style (double-quoted scalars; escape inner `"` as `\"`). Edit with exact string
   replacements. After editing run `pnpm check:packs` and the length measure; fix until 0 problems for your items.
8. **Grounding note** `.planning/tasks/MF-0061/grounding/G<n>.md`: one table per item: `item · new lengths
   (key/longest, ratio) · what changed · key: quoted passage (page short name) · each distractor: quoted passage that
   refutes it`. Silence in the page is not a refutation; an empty cell is a FIX the verifier will raise.

## Groups

- **G1** ccdv-f D1, D2 (15): D1.S1 q1 q2 · D1.S2 q1 · D1.S3 q1 q2 · D2.S1 q1 q2 · D2.S2 q2 · D2.S3 q1 q2 · D2.S4 q1 q2
  · D2.S5 q1 q2 · D2.S6 q2
- **G2** ccdv-f D4, D5, D6 (13): D4.S1 q1 q2 · D5.S1 q1 q2 · D5.S2 q1 q2 · D5.S3 q1 q2 · D5.S4 q1 · D6.S1 q1 q2 ·
  D6.S2 q1 · D6.S3 q2
- **G3** ccdv-f D7, D8 `origin: ai` (10): D7.S1 q1 q2 · D7.S2 q1 · D7.S3 q1 · D7.S4 q1 · D8.S1 q1 · D8.S2 q1 q2 ·
  D8.S3 q1 q2 (never the `official-1` items)
- **G4** prod-prompting D1 (15): D1.S1 q2 q3 q4 q5 q6 · D1.S2 q2 q3 q4 q5 q6 · D1.S3 q1 q2 q3 q4 q5
- **G5** prod-prompting D2, D3 (13) + platform-foundations (2): D2.S1 q2 q3 q5 q6 · D2.S2 q1 q3 · D2.S3 q6 · D3.S2 q1
  q2 q5 · D3.S3 q1 q4 q5 · platform-foundations D1.S1 q4 · D4.S1 q2

## Rebalance brief (U-6, 2026-11-07; each H-drafter gets this plus the Drafting brief above)

Goal: in each listed question the key must stop being the STRICTLY longest option. Make one distractor at least as
long as the key, preferably 3–15 characters longer, by adding a plausible-but-wrong detail the cited page refutes (or a
detail that belongs to a different situation on that page). Prefer lengthening a distractor over shortening the key;
never cut a qualifier that makes the key right. Keep the 1.15× rule (it can only improve), ≤ 4 options, key letter,
stem, source. Do not make the lengthened distractor an outlier (no option more than ~25% longer than the next), do not
add absolute words to distractors only, do not echo the stem in the key. Measure with `share.mjs <worktree> <pack> -v`
(the listed ids must disappear from its output) and `measure.mjs`. Grounding note `grounding/H<n>.md`, same table.

## Rebalance groups (U-6)

- **H1** ccdv-f (12): D5.S2.q1 · D2.S3.q1 · D6.S1.q2 · D8.S2.q1 · D6.S2.q1 · D1.S2.q1 · D7.S1.q2 · D2.S6.q2 · D2.S1.q2 ·
  D2.S4.q1 · D5.S1.q1 · D4.S1.q1
- **H2** prod-prompting D1 (14): D1.S1 q2 q3 q4 q5 q6 · D1.S2 q2 q3 q6 · D1.S3 q1 q2 q3 q4 q5 q6
- **H3** prod-prompting D2–D3 (10): D2.S1 q1 q3 · D2.S3 q1 q6 · D3.S1 q3 q5 · D3.S2 q2 q5 · D3.S3 q3 q6
- **H4** claude-code-in-action (10): D2.S5.q5 · D3.S2.q4 · D1.S1.q3 · D3.S2.q2 · D2.S2.q5 · D2.S3.q1 · D2.S1.q1 ·
  D2.S6.q4 · D2.S1.q3 · D2.S6.q2

## Rank brief (U-7, 2026-11-07; each R-drafter gets this plus the Drafting brief above)

The rule now ranks each single-select, non-official key by length among its 4 options (rank = 1 + number of options
strictly longer than the key: longest, 2nd longest, 3rd longest, shortest; ties share the better rank). Per pack, no
rank may hold more than 40% of questions; aim for a near-uniform spread (each rank ≤ ~33%). Your group has a quota of
questions to MOVE from an over-full rank to an under-full one (see the group line). Choose the questions where the
move reads most naturally.

How to move a key:
- Down (to 3rd longest / shortest): reword two or three distractors so they are naturally longer (a fuller, grounded
  wrong claim), or tighten the key by removing words that carry no part of why it is right. Never drop a qualifier
  that makes the key right.
- Up (to longest): add a page-grounded qualifier or condition to the key, or SHORTEN distractors by removing filler.
  Keep the 1.15× pair rule: key / longest distractor < 1.15 (aim ≤ 1.08).
- No tacked-on filler (review note 5: "…instead", "exactly as it is", "beside the page"); vary lengths by rewording
  so each option reads as written once. Do not repeat a pattern across a pack's distractors (review note 4: three
  ccdv-f distractors open "Switch to a larger, more capable model").
- Same discipline as before: grounded in the cited page, drafter checks 1–4, keep key letter, ≤ 4 options, stem and
  source unchanged, no absolutes-only-in-distractors, no stem echo in the key, no copying 12+ words.
Measure: `node <scratchpad>/mf0061/rank.mjs <worktree> <pack> [-v]` (per-question rank + pack distribution) and
`measure.mjs` (pair ratio). Record every question you change in `grounding/R<n>.md` (id · rank before → after ·
options changed · quoted passage for each changed option).

## Rank groups (U-7; pack distribution before → quota)

- **R1** agent-skills (all files): longest 0 · 2nd 14 · 3rd 11 · shortest 29 (54%). Move ~13 off "shortest": ~10 to
  longest, ~3 to 2nd/3rd. Target: no rank > 17 (31%).
- **R2** ai-capabilities (all files): longest 3 · 2nd 24 (50%) · 3rd 15 · shortest 6. Move ~10 off "2nd longest":
  ~8 to longest, ~2 to shortest. Target: no rank > 16 (33%).
- **R3** ccdv-f (all files; never the `official-1` items): longest 17 · 2nd 20 (44%) · 3rd 6 · shortest 2. Move ~6
  off longest and ~9 off 2nd longest, to 3rd (~5) and shortest (~10). Target: no rank > 14 (31%). Also fix review
  note 4 (vary the "larger, more capable model" distractors in D4.S1, D1.S3, D7.S1) and note 5 (`D8.S2.q1` D echoes
  the stem's "authenticated network access").
- **R4** prod-prompting D1.S1–D1.S3: 3 longest · 15 at 2nd longest. Move 8 of the 2nd-longest keys to 3rd/shortest
  (about half each). Also fix note 5 padding in `D1.S1.yaml` ("…spoken answer instead", "…exactly as it is").
- **R5** prod-prompting D2.S1–D3.S3: 12 longest · 21 at 2nd longest · 3 at 3rd. Move 11 of the 2nd-longest and 2 of
  the longest keys to 3rd/shortest (about half each). Also fix note 5 padding in `D3.S3.yaml` ("…inside each tool
  result, beside the page, …"). Pack target with R4: longest ≤ 14, 2nd ≤ 17, 3rd and shortest ≈ 11–13 each.

## Verify

- `pnpm typecheck && pnpm lint && pnpm test && pnpm gate:planning && pnpm gate:workspace && pnpm check:packs`.
- DB: `pnpm db:reset`, `pnpm db:sync-keys` ×2, `pnpm test:db` (db lock).
- No browser (no UI change). Show-it command: `pnpm check:packs`.
- Fresh-context `diff-reviewer`: dispatched by the orchestrator (U-2).

## Tasks

```json tasks
[
  { "id": "T1", "title": "remove grandfather set, exempt origin official, inner tests, MF-0044 re-freeze", "agent": "inline",
    "owns": ["scripts/lib/key-length.mjs", "scripts/check-pack-grounding.mjs", "src/test/__tests__/key-length.test.ts", "src/test/__tests__/mf-0044-key-length.acceptance.test.ts", "src/test/__tests__/mf-0061-key-length-retrofit.acceptance.test.ts", ".planning/tasks/MF-0044/FROZEN.json"],
    "depends_on": [], "closes": ["SC-1", "SC-2"],
    "done_when": ["pnpm exec vitest run --project unit src/test/__tests__/key-length.test.ts src/test/__tests__/mf-0044-key-length.acceptance.test.ts", "pnpm typecheck"],
    "context": ["skill:testing-strategy"] },
  { "id": "T2", "title": "draft G1-G5 rewrites", "agent": "inline",
    "owns": ["packs/ccdv-f/questions/**", "packs/prod-prompting/questions/**", "packs/platform-foundations/questions/**", ".planning/tasks/MF-0061/grounding/**"],
    "depends_on": [], "closes": ["SC-4", "SC-5"],
    "done_when": ["pnpm check:packs"],
    "context": ["file:.planning/tasks/MF-0061/LOOP-PLAN.md"] },
  { "id": "T3", "title": "fresh verifiers G1-G5, fold FIX", "agent": "inline",
    "owns": [".planning/tasks/MF-0061/verify/**", "packs/ccdv-f/questions/**", "packs/prod-prompting/questions/**", "packs/platform-foundations/questions/**"],
    "depends_on": ["T2"], "closes": ["SC-6", "SC-3"],
    "done_when": ["pnpm check:packs", "pnpm exec vitest run --project unit src/test/__tests__/mf-0061-key-length-retrofit.acceptance.test.ts"],
    "context": ["file:.planning/tasks/MF-0042/verify/G1.md"] },
  { "id": "T5", "title": "U-6/U-7 key-rank rule + inner tests + SC-9 frozen test", "agent": "inline",
    "owns": ["scripts/lib/key-length.mjs", "scripts/check-pack-grounding.mjs", "src/test/__tests__/key-length.test.ts", "src/test/__tests__/mf-0061-longest-key-share.acceptance.test.ts"],
    "depends_on": ["T1"], "closes": ["SC-9"],
    "done_when": ["pnpm exec vitest run --project unit src/test/__tests__/key-length.test.ts src/test/__tests__/mf-0061-longest-key-share.acceptance.test.ts"],
    "context": ["skill:testing-strategy"] },
  { "id": "T6", "title": "U-6/U-7 rebalance drafters H1-H4, R1-R5 + fresh verifiers, fold FIX", "agent": "inline",
    "owns": ["packs/ccdv-f/questions/**", "packs/prod-prompting/questions/**", "packs/claude-code-in-action/questions/**", "packs/agent-skills/questions/**", "packs/ai-capabilities/questions/**", ".planning/tasks/MF-0061/grounding/**", ".planning/tasks/MF-0061/verify/**"],
    "depends_on": ["T3", "T5"], "closes": ["SC-10"],
    "done_when": ["pnpm check:packs"],
    "context": ["file:.planning/tasks/MF-0061/LOOP-PLAN.md"] },
  { "id": "T4", "title": "DB sync proof, gates, verify, evidence", "agent": "orchestrator",
    "owns": [".planning/tasks/MF-0061/LOOP-VERIFY.md", ".planning/tasks/MF-0061/**", ".planning/evidence/MF-0061.md"],
    "depends_on": ["T1", "T3", "T6"], "closes": ["SC-7", "SC-8"],
    "done_when": ["pnpm typecheck && pnpm lint && pnpm test && pnpm gate:planning && pnpm gate:workspace && pnpm check:packs"],
    "context": [] }
]
```
