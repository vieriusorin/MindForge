---
ticket_id: MF-0036
tier: normal                      # dev tooling: an offline content check; no app code, no DB
stage: handoff
goal_status: complete-pending-manual-commit
builds_on: [MF-0016, MF-0033]
---

> Reserved 2026-11-04 by the MF-0016 retro (Action 2). Not built until the user picks it up. Build
> after (or together with) MF-0033, which owns `scripts/check-pack-grounding.mjs`.

## Objective

**Today.** A cuckoo must hold exactly one false line, but nothing checks that the OTHER lines are true.
MF-0016's first review found `packs/ccdv-f/cuckoos/D7.S2.yaml` line 3 ("… so keys never enter the
context") false per its cited permissions page, which made a second flaw that would have graded an
informed learner wrong. This is the MF-0031 lesson `ai-content-claims-outrun-source` on a new item kind.

**End state.** `pnpm check:packs` (MF-0033) gains a cuckoo rule: for every `packs/*/cuckoos/*.yaml` item,
each entry of `lines` except `lines[flawLine - 1]` fails when it contains an absolute quantifier
(`never`, `always`, `only`, `all`, `every`, `cannot`, `guarantee`, `no … can`) absent from the cached text
of one of the item's `sources` (`.cache/corpus/<sha256(url)>.json`), unless the item carries
`# grounded: <word>`; a non-flaw line whose backticked token is absent from the cited text also fails.
Skips with a message when `.cache/corpus/` is absent. `.claude/rules/testing.md` "Before hand-off" lists
`pnpm check:packs` for tickets touching `packs/**` (guarded file: ask the user).

## Proof cases

- RED on the pre-fix text of D7.S2 line 3: `"- We deny Read(./.env) so keys never enter the context."`
- GREEN on the shipped 14 cuckoos (or each hit justified with `# grounded:`).

## Intake findings (2026-11-04, read-only probes)

- **MF-0033 is not built.** `scripts/check-pack-grounding.mjs` and a `check:packs` script do not exist
  (`ls scripts`, `package.json`). `ticket:verify/freeze/eval` are not in `package.json` either (libs exist
  under `scripts/lib/`), so the defaults run by hand.
- **The draft rule does not catch its own proof case.** The cited permissions page
  (`.cache/corpus/7b0e64d4….json`) contains `never` 12 times (e.g. "removes the tool from Claude's context
  entirely, so Claude never sees it"). A "quantifier absent from the whole cited text" check passes the
  pre-fix D7.S2 line 3. The rule must be stricter than document-level presence.
- **Shipped content defect found by the probe.** `packs/ccdv-f/cuckoos/D6.S1.yaml`,
  `ccdv-f.D6.S1.cuckoo-keep-every-tool-result`: `flawLine: 3` keys `"2. Fetch files when you need them; …"`
  (a true line). The false line is `lines[3]` ("3. Never clear old tool results …"), so `flawLine` should be
  4. The list's own numbering ("2.", "3.") is one behind the 1-based line index. A learner who picks the
  real flaw is graded wrong. The other 13 cuckoos key the line their explanation describes. Not on `main`
  yet (`git log main -- packs/ccdv-f/cuckoos` is empty): it is on the unmerged MF-0016 branch.
- **Corpus gap.** Both `ccdv-f.D7.S1` cuckoos cite the exam-guide PDF, which has no `.cache/corpus` file:
  `src/content-pipeline/corpus.ts` reports a non-text content type as `unsupported` and never stores it
  (`runs.log`: `unsupported=1`). `mitigate-jailbreaks` is cached. `cuckoo-log-full-prompts` cites only the PDF.
- Under "always annotate", 6 non-flaw lines across the 14 shipped cuckoos contain an absolute word (5×`only`,
  1×`can't`, 1×`Never`), most of them prompt instructions ("Never discuss another customer's invoices"),
  which no source can quote.
- Probe over the 14 shipped cuckoos with the draft rule: 1 quantifier hit (the D6.S1 line above),
  1 backtick hit (`explorer` in D6.S1 line 2, absent from the sub-agents page).
- A `# grounded:` YAML comment does not change `contentHash` (it hashes the parsed item), so it resets no
  reviews; reading it needs `YAML.parseDocument`, not `YAML.parse`.

## Decided by the user (2026-11-04)

- U-1: the D6.S1 `flawLine` defect is fixed in MF-0016 before merge (done: `flawLine: 4`, regression test
  `src/engine/content/__tests__/cuckoo-flaw-keys.test.ts` RED then green, `.planning/evidence/MF-0016.md`).
- U-2: scope is the cuckoo rule only. MF-0036 creates `scripts/check-pack-grounding.mjs` + `pnpm check:packs`;
  MF-0033 later adds question/card/diagram rules to the same script.
- U-3: quantifier rule = always annotate. An absolute word in a non-flaw line fails unless the item carries
  a `# grounded:` comment for that word, whatever the cited page says.
- U-4: a cited source with no corpus file fails the item (see Concern C-1). A missing `.cache/corpus/` skips.
- U-6 (resolves C-1): a cited source with no corpus text fails unless the item carries
  `# uncached: <url> — <reason>`. The exemption covers only "source missing"; a quoted annotation or a
  backtick token still needs a cached source. The two `ccdv-f.D7.S1` cuckoos get one each for the PDF.
- U-7: SC-1…SC-8 and D-1…D-5 approved as the contract (2026-11-04).
- U-5: `.claude/rules/testing.md` "Before hand-off" gains `pnpm check:packs` for tickets touching `packs/**`.

## Decided without a question

- D-1 Annotation grammar: `# grounded: <word> — <justification>` inside the item's YAML block (between its
  `- id:` line and the next item). A justification in double quotes is a claim: it must occur verbatim
  (case- and whitespace-insensitive) in one cached source's text and contain the word. Unquoted text is a
  reason (e.g. `instruction in the snippet, not a doc claim`). Source: U-3 plus the 6 instruction hits
  above, which no quote can ground. An empty justification fails. An annotation whose word no non-flaw line
  uses fails as stale.
- D-2 Backtick rule: a backticked token in a non-flaw line must occur (case-sensitive substring) in one
  cached source's text, unless the item carries `# example-name: <token>` (a name invented for the snippet,
  e.g. the `explorer` subagent in D6.S1). Source: GOAL end state; the probe's one hit is an invented name.
- D-3 Word list: `never`, `always`, `only`, `all`, `every`, `cannot`, `can't`, `guarantee(s|d)`, and
  `no … can` within one sentence, as whole words, case-insensitive (`allow`, `everything` do not match).
  `can't` is added as the contraction of `cannot`. Source: GOAL end state.
- D-4 Comments do not change `contentHash` (it hashes the parsed item), so annotating resets no reviews.
  Proved by SC-7, not assumed.
- D-5 The pure checker lives in `scripts/lib/cuckoo-grounding.mjs` and is tested from `src/test/__tests__/`
  (precedent: `scripts/lib/redact-secrets.mjs` + `mf-0018-redact-secrets.test.ts`). The CLI only does I/O.

## Success Criteria

Proof fixtures are inline YAML + inline corpus text in the test, so CI (no `.cache/`) runs them.

- [x] SC-1 A D7.S2-shaped snippet with line 3 = `"- We deny Read(./.env) so keys never enter the context."` and no annotation yields a
  problem naming the item id, line 3 and `never`. Proof: frozen acceptance test.
- [x] SC-2 The pre-fix D6.S1 `cuckoo-keep-every-tool-result` (`flawLine: 3`) yields a problem for line 4
  `never`; with `flawLine: 4` it yields none for that line. Proof: frozen acceptance test.
- [x] SC-3 Annotations (D-1): unquoted reason passes; quoted text present in the corpus passes; quoted text
  absent fails; empty justification fails; a stale annotation fails; a word in the flaw line needs none.
  Proof: frozen acceptance test, one `it` per row of the edge table.
- [x] SC-4 Backticks (D-2): absent token fails; present token passes; `# example-name:` exempts. Proof: frozen.
- [x] SC-5 Corpus: a source with no corpus text fails the item with a message naming the URL and
  `pnpm generate:corpus`, unless `# uncached: <url> — <reason>` names it (U-6); the CLI with no `.cache/corpus/` prints a skip line and exits 0. Proof: frozen
  test (pure) + CLI run pasted in evidence.
- [x] SC-6 `pnpm check:packs` exits 0 on the real packs after this ticket's annotations, and exits 1 on a
  scratch copy with the D7.S2 pre-fix line. Proof: command output in evidence.
- [x] SC-7 Every shipped cuckoo's `contentHash` is unchanged by the annotations. Proof: hashes before/after
  (`itemHashes`) pasted in evidence.
- [x] SC-8 `.claude/rules/testing.md` "Before hand-off" names `pnpm check:packs` for `packs/**`. Proof: grep.

### Edge-input table (SC-1…SC-5)

| Input | Result | Decided by |
|---|---|---|
| `.cache/corpus/` absent | CLI prints `check:packs: .cache/corpus missing, skipped`, exit 0 | GOAL / U-4 |
| pack with no `cuckoos/` | nothing checked for it | default |
| absolute word in the flaw line | ignored | GOAL |
| absolute word in a non-flaw line, no annotation | fail | U-3 |
| annotation, unquoted reason | pass | D-1 |
| annotation, quoted, in corpus / not in corpus | pass / fail | D-1 |
| annotation, empty / stale | fail | D-1 |
| backtick token in corpus / not / `# example-name:` | pass / fail / pass | D-2 |
| cited source with no corpus file | fail, names URL | U-4 |
| …with `# uncached: <url> — <reason>` | pass; empty reason or stale url fails | U-6 |
| YAML that does not parse | fail, names file | default |

## Constraints → how met

- Offline, no network: reads `.cache/corpus` only. No app code, no DB: `scripts/**`, `packs/**` comments,
  `package.json`, `testing.md`.
- Does not reset reviews: comments only (SC-7).
- Pack-agnostic: the script walks `packs/*/cuckoos`, no slug in code.

## Concerns

- **C-1 (owner: user) — resolved by U-6.** U-4 vs the exam-guide PDF: `corpus.ts` will never store it, so both `ccdv-f.D7.S1`
  cuckoos fail forever under "missing = fail", and `cuckoo-log-full-prompts` cites nothing else. Neither
  D7.S1 cuckoo has a backtick token or needs a quote, so nothing on it is uncheckable today.

## Iteration Log

- 0 (2026-11-04): design → freeze (20 RED) → build → test. Receipt DONE `02d8f4e3854a`. One code fix in BUILD
  (quantifier `word` reported as its lower-case key, per SC-1/SC-2).
