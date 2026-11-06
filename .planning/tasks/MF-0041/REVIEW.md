---
verdict: approve
reviewed_hash: 1a975fcc6b75523492bb2f749c55f93e8834f59491aa4f4c40adff43b1863e4d
reviewed_at: 2026-11-06T10:50:00+02:00
---
Outcome: **PASS-WITH-NOTES**. No blocking findings.

Hash = `{ git diff HEAD -- scripts packs; cat scripts/lib/cuckoo-flaw-key.mjs src/test/__tests__/mf-0041-flaw-key.acceptance.test.ts; } | shasum -a 256`
(the formula the caller asked for; this repo has no `pnpm ticket:verify`).

Verified independently: frozen test LF hash `4e53c0fc…` = FROZEN.json; frozen file 20/20; `pnpm check:packs`
(corpus present) = 7 problems, none flaw-key; corpus-absent path exercised on a copy of `scripts/` + `packs/`
with no `.cache/corpus`: exit 0 / "flaw-key: 0 problem(s)", and exit 1 with the D6.S1 message once its
`# flaw-line:` note is removed. No double reporting: `checkFlawKeys` runs once per file and returns `[]` on
parse errors (`checkCuckooFile` owns those). Files touched = plan `owns` exactly.

## Findings
- [note] scripts/lib/cuckoo-flaw-key.mjs:23-28: the rule looks only at the keyed line's label, so a
  mis-key passes silently whenever the keyed line is unlabelled or its label happens to equal `flawLine`.
  Inputs: `lines: ["1. Read.", "Note: tests are optional", "2. Skip review and merge."], flawLine: 2`
  (author meant label 2 = line 3; returns `[]`), and two lists `["1. a","2. b","Then:","1. c","2. d","3. e"],
  flawLine: 2` meant for "2. d" (returns `[]`). Both are "pass" rows of GOAL's edge table (draft-decided),
  so this is in spec, but the rule does not catch every label-keyed mis-key. A follow-up could fire when the
  label `flawLine` exists on a line other than `flawLine`.
- [note] scripts/lib/cuckoo-flaw-key.mjs:78-79: notes are read from the item's YAML `range`, which does not
  include a comment placed above the item's `- id:` line (or at file top). A note there is silently ignored:
  on a firing item the author gets "add # flaw-line:" (fail-safe, confusing message); on a non-firing item
  the orphan note is never reported stale, so D-4's "stale annotation fails" holds only for notes inside the
  item block. Input: `cuckoos:\n  - id: a … flawLine: 2\n  # flaw-line: 4 — "Never clear old tool results" — r\n  - id: b … flawLine: 2`
  → `[]`. An inline `- id: x # flaw-line: …` is also not seen (NOTE_ANY anchors at line start). Same
  convention as MF-0036's `# grounded:`; documenting "first line under `- id:`" would close the confusion.
- [note] scripts/lib/cuckoo-flaw-key.mjs:79: the block is scanned as raw text, so a block-scalar value line
  starting with `# flaw-line:` (e.g. `explanation: |` then `  # flaw-line: …`) is taken as a note and reported
  stale. False positive, contrived input; fails loud, not silent.
- [note] scripts/lib/cuckoo-flaw-key.mjs:41: the 3-word minimum counts whitespace tokens, so the list label
  counts as a word: `# flaw-line: 4 — "3. Never clear" — r` passes on the D6.S1 shape. It still uniquely
  identifies line 4 (the uniqueness check holds), so the Q-1 intent is met; D-6's "3 words" is slightly
  weaker than written.
- [note] scripts/check-pack-grounding.mjs:39-45: `readdirSync(PACKS)` now runs before the corpus-absent
  exit, so with no corpus and a bad `MF_PACKS_DIR` the CLI throws ENOENT instead of the previous exit 0
  "skipped". Not reachable with the default `packs/`; with a corpus present it already threw.
- [note] src/test/__tests__/mf-0041-flaw-key.acceptance.test.ts:76: SC-1 asserts the message contains "2",
  which any message would satisfy via other text; the implementation does name `labelled "2."` and
  `line 3` (cuckoo-flaw-key.mjs:86,100), so the SC is met in behaviour, the frozen assertion is just weak.
- [note] C-1 restated, not a defect: a note quoting the keyed line passes whether that line is the false one
  or not (pre-fix `flawLine: 3` + `# flaw-line: 3 — "Fetch files when you need" — …` passes). Accepted by
  the user in Q-1; the quote makes the keyed text visible to the reviewer of the YAML.
