---
ticket: MF-0036
iteration: 0
---
# LOOP-PLAN — MF-0036 cuckoo rule for `pnpm check:packs`

## Discovery
- No `check:packs`, no `scripts/check-pack-grounding.mjs` (MF-0033 unbuilt, U-2).
- Precedent for a pure `.mjs` tested from `src/test/__tests__/`: `scripts/lib/redact-secrets.mjs`.
- Corpus file = `.cache/corpus/<sha256(url)>.json` with `{ url, text, … }` (`src/content-pipeline/corpus.ts`).
- `contentHash` hashes the parsed item (`scripts/lib/content-hash.mjs`), so YAML comments do not reach it.
- `yaml` `parseDocument`: each seq item's `range` slice includes its inner comments (probe, 2026-11-04).
- Gates touched: none (no allowlists). Guarded file: `.claude/rules/testing.md` (approved, U-5).

## Frozen files this will re-freeze
None. Grep over `**/*.acceptance.test.*` for `check:packs`, `check-pack-grounding`, `cuckoo-grounding`:
only this ticket's file. Comments added to `packs/ccdv-f/cuckoos/*.yaml` change no parsed value, so
MF-0016 SC-8 and the content loaders read the same items (SC-7 proves the hashes).

## Steps
1. `scripts/lib/cuckoo-grounding.mjs` — `checkCuckooFile({ file, text, corpus })` → `GroundingProblem[]`.
   Parse with `YAML.parseDocument`; per item, slice the raw block by `range` and read `# grounded:`,
   `# example-name:`, `# uncached:` lines; apply D-1…D-3, U-6. Pure: corpus is a function.
2. `scripts/check-pack-grounding.mjs` — walks `packs/*/cuckoos/*.yaml`, corpus reader over
   `.cache/corpus`, skip line + exit 0 when the dir is absent, prints problems, exit 1 on any.
   `package.json`: `"check:packs": "node scripts/check-pack-grounding.mjs"`.
3. Annotate the shipped cuckoos the check flags (comments only), each with a reason or a verified quote.
4. `.claude/rules/testing.md` "Before hand-off": add `pnpm check:packs` for `packs/**`.
5. Verify: SC-6 real run + scratch-copy red run, SC-7 hashes before/after, full gates.

## Riskiest step
Step 3: an annotation that rubber-stamps a false line. Mitigation: every `grounded` on a claim uses a
quoted sentence that the checker finds in the cited text; free-text reasons only for instructions or
config inside the snippet, and each is read against the line in review. No re-runnable writes, no DB,
no deletes, so the re-run/state checklist (seed/sync) does not apply.

## Rejected options
- Whole-page word presence (the drafted rule): passes the motivating D7.S2 line (`never` ×12 on the page).
- Sentence-similarity matching: heuristic, can pass false lines (U-3).
- A YAML key for the allowlist: changes `contentHash` and resets reviews (MF-0033 open question).

```json tasks
[
  {"id":"T1","agent":"service-builder","owns":["scripts/lib/cuckoo-grounding.mjs"],"depends_on":[],"closes":["SC-1","SC-2","SC-3","SC-4","SC-5"],"done_when":"mf-0036 acceptance file green","context":"GOAL D-1..D-3, U-6"},
  {"id":"T2","agent":"service-builder","owns":["scripts/check-pack-grounding.mjs","package.json"],"depends_on":["T1"],"closes":["SC-5","SC-6"],"done_when":"skip run exits 0; scratch pre-fix run exits 1","context":"corpus path rule"},
  {"id":"T3","agent":"service-builder","owns":["packs/ccdv-f/cuckoos/*.yaml"],"depends_on":["T2"],"closes":["SC-6","SC-7"],"done_when":"pnpm check:packs exits 0; hashes unchanged","context":"comments only"},
  {"id":"T4","agent":"service-builder","owns":[".claude/rules/testing.md"],"depends_on":[],"closes":["SC-8"],"done_when":"grep shows check:packs","context":"U-5"}
]
```
