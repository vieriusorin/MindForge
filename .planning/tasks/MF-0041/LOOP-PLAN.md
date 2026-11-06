# MF-0041 LOOP-PLAN (iteration 0)

## Discovery
- Precedent: MF-0036 `scripts/lib/cuckoo-grounding.mjs` (pure checker, block comments read via `node.range`,
  `GroundingProblem` shape) + `scripts/check-pack-grounding.mjs` (CLI, I/O only). Same split here (GOAL D-1, MF-0036 D-5).
- `check-pack-grounding.mjs:22-27` exits 0 "skipped" before reading any pack when `.cache/corpus` is absent. The new rule
  must run before that exit (D-2, SC-5 in CI).
- Gates the files sit on: `pnpm lint` (biome covers `scripts/**`), `pnpm typecheck` (the frozen test imports the `.mjs`; JSDoc
  types flow in), `pnpm gate:planning` (this ticket's records). No allowlist is touched.
- D6.S1 readers (`cuckoo-flaw-keys.test.ts`, `mf-0016-*.acceptance`, storm tests) read parsed YAML. A comment changes nothing
  parsed, and `contentHash` hashes the parsed item (SC-7).

## Frozen files this will re-freeze
None. Grep over every `*.acceptance.test.*` and `*.test.ts` for `check-pack-grounding`, `cuckoo-grounding`, `GroundingRule`,
`check:packs`, `D6.S1`, `cuckoo-keep-every-tool-result`, `MF_PACKS_DIR`. Each hit was read:
- `mf-0036-cuckoo-grounding.acceptance`: calls `checkCuckooFile` only. Untouched by D-1 (its `toEqual([])` on the labels-trail-by-1
  shape is why the rule is a separate export).
- `mf-0033-item-grounding.acceptance`: calls `checkItemFile` only and never spawns the CLI.
- `mf-0016-cuckoo-content`, `mf-0016-session`, `mf-0013-storm`, `storm-shortfall`, `cuckoo-flaw-keys`, `mf-0039-agent-skills`:
  these read parsed pack content. A YAML comment changes no assertion.
- `mf-0053`, `mf-0055`: the ticket id or `check-planning.mjs` only.

## SC → steps
| SC | Steps | Proof |
|---|---|---|
| SC-1…SC-4 | 1 | frozen tests 1-18 |
| SC-5 | 2 | frozen SC-5 (spawned CLI) |
| SC-6 | 3 | frozen SC-6 (real `packs/`) |
| SC-7 | 3 | `hashes-before.txt` (scratchpad, 14 rows) vs after, in evidence |
| SC-8 | all | `shasum` of the MF-0036 file = FROZEN.json, plus `pnpm test` |
| SC-9 | 2, 3 | `pnpm check:packs` output: 0 `flaw-line` lines, 7 problems (baseline) |

## Steps
1. `scripts/lib/cuckoo-flaw-key.mjs`: replace the stub with `checkFlawKeys({ file, text })`.
   - `LABEL = /^\s*(\d+)[.)]\s/`. `NOTE_ANY = /^\s*#\s*flaw-line:/`.
     `NOTE = /^\s*#\s*flaw-line:\s*(\d+)\s*(?:—|--)\s*"([^"]+)"\s*(?:—|--)\s*(\S.*?)\s*$/`.
   - Parse with `YAML.parseDocument`. On parse errors or no `cuckoos` seq, return `[]`: `checkCuckooFile` and the zod loader
     already report those, and a second report would duplicate them.
   - Per item map: `block = text.slice(range[0], range[2])`, and `notes` = the block lines matching `NOTE_ANY`.
     `flaw = lines[flawLine - 1]`. The rule fires when `Number.isInteger(flawLine)`, `typeof flaw === "string"`, at least 2 string
     lines match `LABEL`, `flaw` matches `LABEL`, and its label `!== flawLine`.
   - Not firing: every note → `flaw-key` "stale" problem (D-4). Firing with no note → problem
     `{ file, id, line: flawLine, rule: "flaw-key" }`. Message: `<file>: <id> line <n>: flawLine <n> keys the line labelled
     <label>.; check the false line, then add # flaw-line: <n> — "<3+ words of that line>" — <why the label differs>`.
   - Firing with notes: each note must match `NOTE`, with `n === flawLine`, the fragment ≥ 3 words (`/\s+/` split of the trimmed
     text), `lines[n-1].includes(fragment)`, and no other string line including it. Each failure is a problem naming which check failed.
   - `scripts/lib/cuckoo-grounding.mjs`: add `"flaw-key"` to the `GroundingRule` JSDoc union. This is a type-only line.
2. `scripts/check-pack-grounding.mjs`: before the corpus-absent exit, walk `PACKS/*/cuckoos/*.yaml` and collect
   `checkFlawKeys` problems. When the corpus is absent, print them plus the existing "skipped" line, and exit 1 if any were found,
   0 otherwise. When it is present, they join `problems` (one summary count). The header comment names the rule.
3. `packs/ccdv-f/cuckoos/D6.S1.yaml`: under `- id: ccdv-f.D6.S1.cuckoo-keep-every-tool-result` add
   `# flaw-line: 4 — "Never clear old tool results" — line 1 is a heading, so each list label trails its line number by 1`.
   Then hash all 14 cuckoos again and diff against `hashes-before.txt`.
4. TEST: run the full ladder, then fresh-context `diff-reviewer` (high-risk), then the evidence with a "See it yourself" command block.

## Riskiest step
Step 2. The corpus-absent path changes from "always exit 0" to "exit 1 on a flaw-key problem". Nothing in CI or hooks runs
`check:packs` today (grep `.github`, `.husky`), so no pipeline changes colour. The shipped packs have 0 flaw-key problems after step 3
(SC-6), so a fresh clone keeps exit 0. Not a re-runnable writer and no DB: the MF-0029/MF-0034 state checks do not apply.
No versioned-judgement write.

## Rejected options
- Rule inside `checkCuckooFile`: it reddens the frozen MF-0036 SC-2 and SC-3 tests (they assert the labels-trail-by-1 shape is clean) and would need a re-freeze.
- Rule in the zod `CuckooSchema`: the schema never sees YAML comments, so the annotation could not exist.
- An `MF_CORPUS_DIR` override to test the corpus-absent path locally: CI already runs SC-5 without a corpus (D-7, YAGNI).
- Number-only annotation: the user chose quote + reason (Q-1).

```json tasks
[
  { "id": "T1", "agent": "service-builder", "owns": ["scripts/lib/cuckoo-flaw-key.mjs", "scripts/lib/cuckoo-grounding.mjs"],
    "depends_on": [], "closes": ["SC-1", "SC-2", "SC-3", "SC-4"],
    "done_when": "frozen tests SC-1..SC-4 green; MF-0036 file green", "context": "Step 1" },
  { "id": "T2", "agent": "service-builder", "owns": ["scripts/check-pack-grounding.mjs"],
    "depends_on": ["T1"], "closes": ["SC-5", "SC-9"],
    "done_when": "frozen SC-5 green; check:packs prints 7 problems, none flaw-key", "context": "Step 2" },
  { "id": "T3", "agent": "service-builder", "owns": ["packs/ccdv-f/cuckoos/D6.S1.yaml"],
    "depends_on": ["T1"], "closes": ["SC-6", "SC-7"],
    "done_when": "frozen SC-6 green; 14 content hashes identical", "context": "Step 3" },
  { "id": "T4", "agent": "verifier", "owns": [], "depends_on": ["T2", "T3"], "closes": ["SC-8"],
    "done_when": "full pnpm test green; MF-0036 hash = FROZEN.json; diff-reviewer PASS", "context": "Step 4" }
]
```
