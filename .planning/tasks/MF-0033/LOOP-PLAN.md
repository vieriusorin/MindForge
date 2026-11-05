# LOOP-PLAN — MF-0033 (iteration 0)

## Discovery
- `scripts/check-pack-grounding.mjs` (MF-0036) walks `packs/*/cuckoos/*.yaml`, reads the corpus at
  `.cache/corpus/<sha256(url)>.json` (`.text`), and exits 0 with a skip message when the corpus dir is absent.
  `MF_PACKS_DIR` overrides the packs dir. The cuckoo rule is in `scripts/lib/cuckoo-grounding.mjs` (pure, JSDoc
  typed, parses with `yaml`, and reads per-item comment annotations from the item node's `range`).
- Item shapes: a question has `stem`, `options[].text|rationale` and `source.url`; a card has `concept`, `simply`,
  `inNature`, `whereItBreaks[]`, `contrast` and `sources[]`; a diagram has `title`, `nodes[].label`,
  `edges[].label?` and `sources[]`.
- `contentHash` hashes the parsed item, so comment annotations are hash-neutral.
- Precedent: MF-0036. Same split: a pure lib checker plus thin script wiring plus content annotations.
- Frozen files this will re-freeze: none. `grep -ln "check-pack-grounding|check:packs|cuckoo file(s)"` over the
  acceptance tests finds only `mf-0036-cuckoo-grounding.acceptance.test.ts`, which imports `checkCuckooFile`
  (unchanged). The summary line changes from "N cuckoo file(s)" to a combined line, and no test asserts it.
  `mf-0014` references `ccdv-f.D1.S3.diagram-bee-agent-loop` only through its own golden copy (id + `flaw: null`).

## SC → steps
| SC | Steps | Proof |
|---|---|---|
| SC-1, SC-2, SC-3 | T1 | frozen `mf-0033-item-grounding.acceptance.test.ts` green |
| SC-4 | T2 | command runs: planted `end_turn` in a temp packs copy → exit 1; corpus dir absent → exit 0 |
| SC-5 | T3 | `pnpm check:packs` exit 0 on the shipped tree; `pnpm test` green |

## Steps
1. **T1** `scripts/lib/item-grounding.mjs`: `checkItemFile({ file, kind, text, corpus })` →
   `{ problems, checked, skipped }`. Parse with `YAML.parseDocument`; for each item node read its block
   (`node.range`) for `# example-name: <token>` and `# framing: <term> — <reason>` (`—` or `--`). Skip
   (count it) when any cited url gives `null`. Token rule = SC-1, leak rule = SC-2. Report one problem per
   (item, rule, word); messages are `<file>: <id>: <rule> "<word>" not on the cited page (…hint)`.
2. **T2** `scripts/check-pack-grounding.mjs`: also walk `questions/`, `cards/` and `diagrams/` per pack and sum
   problems, checked and skipped. Summary: `check:packs: N cuckoo file(s), M item(s) checked, K skipped (source not
   cached), P problem(s)`. Corpus-absent behaviour is unchanged.
3. **T0/T3** content: the two SC-5 rewrites, then run `pnpm check:packs` and annotate each remaining hit with
   `# example-name:` or `# framing: — <reason>`, each after reading the line against the page (a hit that is a real
   defect stops for the user, not an annotation).

## Riskiest step
T3: annotating can hide a real defect. Each annotation is decided by reading the line and the cached page, and the
evidence lists every annotation with its reason so the reviewer can audit it. A re-run is idempotent: the script only
reads and has no persistent state.

## Rejected options
- An allow-list as a YAML key: it changes `contentHash` and resets reviews.
- The quantifier class: no yield, and its proof case cannot go RED (user, checkpoint 1).
- A sibling-source term discovery: no measured yield (YAGNI).
- Failing on uncached sources: 36% of items would fail on corpus coverage, not content (user, checkpoint 1).

```json tasks
[
  {"id":"T1","agent":"service-builder","owns":["scripts/lib/item-grounding.mjs"],"depends_on":[],"closes":["SC-1","SC-2","SC-3"],"done_when":"mf-0033 acceptance file green","context":"GOAL Success Criteria field list"},
  {"id":"T2","agent":"service-builder","owns":["scripts/check-pack-grounding.mjs"],"depends_on":["T1"],"closes":["SC-4"],"done_when":"planted run exits 1; corpus-absent run exits 0","context":"MF_PACKS_DIR override"},
  {"id":"T3","agent":"service-builder","owns":["packs/*/questions/*.yaml","packs/*/cards/*.yaml","packs/*/diagrams/*.yaml"],"depends_on":["T2"],"closes":["SC-5"],"done_when":"pnpm check:packs exits 0; pnpm test green","context":"SC-5 wording; annotate only after reading"}
]
```
