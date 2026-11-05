---
ticket_id: MF-0033
tier: normal                      # dev tooling: an offline content check; no app code, no DB
stage: handoff
goal_status: complete-pending-manual-commit
branch: feat/MF-0033
builds_on: [MF-0008, MF-0031, MF-0036]
---

> Reserved 2026-11-04 by the MF-0031 retro (Action 1). Not built until the user picks it up.

## Objective

**Today.** In MF-0031, 19 of 72 AI-drafted pack items needed fixes after a fresh-context verifier read them against the
cited docs. About 8 were mechanical: a rationale or label naming an identifier the cited page does not contain
(`is_error`, `end_turn` cited to the tool-use overview), or an absolute word the page does not say ("never carry
retry-after", "almost entirely").

> **Superseded at DESIGN (2026-11-05):** the End state, Open questions and Proof cases below are the reserved
> draft, kept for history. The binding scope is "Success Criteria" at the end of this file.

**End state (draft).** `pnpm check:packs` (`scripts/check-pack-grounding.mjs`) runs offline over every pack item and its cited
sources' cached text in `.cache/corpus/<sha256(url)>.json`:
- **Error:** a backticked token, HTTP status code or snake_case identifier in an option rationale, a card field or a
  diagram node/edge label that does not occur in the cited source's cached text. Tokens also present in the item's
  stem/options are exempt.
- **Warning, which fails unless allow-listed per item:** `never`, `always`, `only`, `almost entirely`, `all`,
  `hard contract` in a rationale or `whereItBreaks` line when the cited text does not contain the word.
- Skips with a clear message when `.cache/corpus/` is absent (CI, fresh clones).
- Listed under "Before hand-off" in `.claude/rules/testing.md` for tickets touching `packs/**` (a guarded rule edit:
  the user approves it).

## Open questions
- The allow-list syntax (a YAML key on the item vs a sidecar file). A YAML key changes the content hash and resets reviews.
- Whether the check also runs inside `sync-question-keys.mjs` (it would block syncs on a warning) or only as a hand-off check.
- Yield evidence (MF-0037 retro, 2026-11-04): of 22 FIX in a 64-item AI pack, 0 were an unsupported backticked identifier and at most 3 were absolute-quantifier slips, none using a word on this list ('Most', 'consistent', 'cannot'). MF-0031 predicted about 8 of 19. The rule as written would have caught about 0 of 22. Before building, run the drafted rule read-only over `packs/ai-capabilities/`, `packs/prod-prompting/` and `packs/agent-skills/` (SKILL.md Stage 3: the first run of a new check reviews shipped content) and list the hits; build only if it finds a real defect. The larger classes (missing diagram branches, false analogy claims, distractors refuted by silence) are not checkable by token match, so a verifier pass stays in every pack plan (see `references/templates.md` Course-pack ticket, grounding-note cells).
- Cross-page leak class (MF-0038 retro, 2026-11-05): 3 of 8 FIX in a 73-item pack were a product-surface term in a stem, option, rationale or card/diagram field that does not occur in the item's cited page, while it does occur on a sibling source of the same skill (`claude.ai` in a stem citing `api/rate-limits`; `code execution` in a rationale citing `memory-tool`). Add a third check class to the spec: for each item, collect the surface terms and product nouns found in its text (`claude.ai`, `Claude Code`, `Messages API`, `Projects`, `code execution`, `memory tool`, `incognito`, `Agent Skills`, plus any term that appears in at least one other cited source of the same skill and in no stem or option of that item), and flag it when it is absent from the cited page's cached text. Dry-run it read-only over `packs/platform-foundations/` (its original text is quoted in `.planning/tasks/MF-0038/verify/G3.md` lines 28-29 and `G2.md` line 46) and over the three older packs before building. Unlike the identifier and quantifier classes (0 of 22 hits in MF-0037), this class would have caught 3 of 8 here with a plain substring test.

## Proof cases (from MF-0031 history)
- The pre-fix `packs/prod-prompting/diagrams/D2.S2.yaml` (`end_turn`) and the pre-fix `D3.S3` q5 option D ("never")
  must fail; the post-fix files must pass.

## Facts (re-derived at pickup, 2026-11-05)
- `scripts/check-pack-grounding.mjs` and `pnpm check:packs` already exist (MF-0036, cuckoo rule only). This ticket
  adds rules to that script; it does not create it. The key-length rule is MF-0044, not this ticket.
- The pre-fix proof-case files were never committed (`da583a0` is the only commit for both files). The probe
  rebuilt them from `MF-0031/verify/D2.md:94` and `verify/D3.md:106` (option D text is approximate).
- Corpus coverage: `.cache/corpus` holds 35 pages. Of 490 question/card/diagram items, 178 cite no cached page
  and 42 cite at least one uncached page. platform-foundations: 54 of 73 uncached; claude-code-in-action 44 of 88.
  Most `support.claude.com` and `agent-sdk/*` pages are missing.

## Dry run (read-only probe, scratchpad `probe-mf0033.mjs`, the rules as worded above)
Proof-case replay:
- MF-0031 D2.S2 diagram pre-fix (`no (end_turn)`): RED (token). Post-fix: GREEN.
- MF-0031 D3.S3.q5 pre-fix option D ("never carry retry-after"): **GREEN — the rule cannot catch it.** The word
  is in option *text*, which the quantifier rule does not scan, and the cited errors page itself says "the
  spend-cap 429 never does", so "word absent from the page" passes even if option text is scanned. The real defect
  was a distractor the page could not refute, which no token match sees. (Same trap as MF-0036.)
- MF-0038 D5.S2.q5 pre-fix (`claude.ai` in a stem citing `api/rate-limits`): RED (leak). Post-fix: GREEN.
- MF-0038 D3.S3.q5 pre-fix (`code execution` citing the memory-tool page): not testable, page not cached.

Shipped content, 50 hits over 312 checkable items:
| Class | Hits | Real defect | False positive / unknowable |
|---|---|---|---|
| token | 15 | 2: `ccdv-f.D5.S1.q2` B rationale "temperature, top_p and top_k are removed in newer API versions" (not on the cited effort page, neither token nor "removed"); `ccdv-f.D1.S3.diagram-bee-agent-loop` node E `tool_result` (not on building-effective-agents) | 10 FP: example names (`protect-files.sh`, `log-summarizer`, `refactorer`, a deliberately misspelled `max_turns`), YAML snippets (`memory: project`, `skills: [...]`), `is_error: true` / `tools.listChanged` whose identifier IS on the page, a bare `300` read as an HTTP status. 3 unknowable (the term's page is uncached) |
| quantifier (rationale, whereItBreaks) | 6 | 0 by reading each line (all paraphrases of page facts, already verifier-passed in MF-0031) | 6 |
| quantifier widened to option text | +12 | 0 | distractors are false by design ("Never upgrade…") |
| leak (fixed term list) | 9 | 0 confirmed. `platform-foundations.D2.S2.q5` stem frames a claude.ai project but the key rests on the guide only (MF-0038 verifier passed it) | 3 FP (generic "Messages API" framing), 5 unknowable (the term lives on an uncached sibling page) |

Reading: ~2 real defects in 50 hits (precision ~4%); 36% of items are not checked at all; one of the two MF-0031
proof cases cannot go RED by design. The yield claim of MF-0031 ("about 8 of 19") does not hold on shipped content,
matching the MF-0037 retro (0 of 22).
- Correction to the token row above: the `ccdv-f.D5.S1.q2` claim is TRUE. It is on
  `about-claude/model-deprecations` ("`temperature`, `top_p`, `top_k` | Removed in API version `2026-10-21`"),
  not on the cited effort page. It is a cross-page leak, so the fix grounds the rationale on the cited page; it does
  not delete a false fact.

## Decided by the user (checkpoint 1, 2026-11-05)
- **Narrow, then build.** Build the token class and the leak class. Drop the quantifier class: no defects found,
  and its proof case cannot go RED. Drop bare HTTP status numbers from the token class. Fix the 2 defects found as T0.
  An item whose cited page is not cached is reported in a skipped count, never passed silently.

## Decided without a question
- Allow-list = YAML comments in the item's block (`# example-name: <token>`, `# framing: <term> — <reason>`), the
  MF-0036 cuckoo form. Comments do not change `contentHash` (`scripts/lib/content-hash.mjs` hashes the parsed
  item), so annotating does not reset reviews. This closes open question 1.
- Not run inside `sync-question-keys.mjs`: it stays a hand-off and drafter-loop check (`testing.md:53`;
  `references/templates.md` Course-pack ticket: drafters run `pnpm check:packs`). This closes open question 2.
- No `testing.md` edit: `check:packs` is already listed for `packs/**` (MF-0036).
- The "any term on a sibling source" variant of the leak class is dropped. It has no measured yield, and the fixed
  list catches the one testable MF-0038 proof case (YAGNI).
- Proof case MF-0031 D3.S3.q5 is removed: it is a distractor the page cannot refute, which no token rule can see.
  A verifier pass stays in every pack plan.
- The cuckoo rule and `checkCuckooFile` are unchanged (MF-0036 frozen test imports it).
- `evals/golden/diagrams/diagrams.yaml` keeps its own copy of the bee diagram (eval fixture, not under `packs/`,
  not scanned). The MF-0014 frozen test asserts only its id and `flaw: null`, so the pack fix leaves it unchanged.

## Success Criteria
Fields scanned. **Question:** option rationales for tokens; stem, option texts and rationales for leaks.
**Card:** concept, simply, inNature, whereItBreaks[], contrast. **Diagram:** title, node labels, edge labels.
"On the page" = case-insensitive substring of the cached text of a cited url.

- [x] **SC-1 Token rule.** In the scanned fields, every backticked span and every unbackticked snake_case
  identifier (`[a-z][a-z0-9]*(_[a-z0-9]+)+`) is on the page. A backticked span also passes when every word in it is
  on the page (words split on whitespace and `` :,.()[]{}="' ``; `_` and `-` stay inside a word). Exempt: a token
  that occurs in the question's stem or option texts, and a token declared `# example-name: <token>` in the item's
  block. Bare numbers are not checked. *Proof:* acceptance test on the pure checker with inline corpus. The pre-fix
  D2.S2 diagram (edge `no (end_turn)`) gives one `token` problem naming the item id and `end_turn`, and the post-fix
  diagram gives none. `` `is_error: true` `` with `is_error` on the page passes. `` `log-summarizer` `` gives a
  problem without `# example-name: log-summarizer` and none with it. A rationale token present in the stem passes.
- [x] **SC-2 Leak rule.** The terms `claude.ai`, `Claude Code`, `Messages API`, `Projects`, `code execution`,
  `memory tool`, `incognito`, `Agent Skills` (case-insensitive) found in any scanned field must be on the page.
  Exempt: `# framing: <term> — <reason>`. A `# framing:` line with no reason is an `annotation` problem. *Proof:*
  acceptance test. The MF-0038 D5.S2.q5 pre-fix stem ("In claude.ai, …" citing a rate-limits text without it) gives
  one `leak` problem naming `claude.ai`, and the post-fix item gives none. A reasonless `# framing: claude.ai` gives
  an `annotation` problem.
- [x] **SC-3 Uncached sources.** Neither rule runs on an item unless every cited url has corpus text. Such an item
  is counted as skipped, and no problem is raised for it. *Proof:* acceptance test with one cached and one uncached url
  and an `end_turn` label: no problem, skipped = 1.
- [x] **SC-4 Wiring.** `pnpm check:packs` runs the cuckoo rule (unchanged) and the new rules over
  `packs/*/{questions,cards,diagrams}/*.yaml`. It prints one problem per line, then a summary with the number of
  checked items, skipped items and problems, and exits 1 on any problem. It still exits 0 with the skip message when
  `.cache/corpus` is absent. *Proof:* a command run on a temp pack copy with one planted `end_turn` exits 1 and names
  it; a run with the corpus dir absent exits 0. Both outputs are pasted in the evidence.
- [x] **SC-5 Shipped content clean (T0 + annotations).** `ccdv-f.D5.S1.q2` B rationale becomes "Temperature is not
  how you control token use; the effort parameter controls how many tokens Claude uses and applies to every output
  token." (effort page: "Control how many tokens Claude uses…", "applies to every output token"). The
  `ccdv-f.D1.S3.diagram-bee-agent-loop` node E becomes "Return nectar: the tool call results" (building-effective-agents:
  "tool call results"). Every other hit is annotated with `# example-name:` or `# framing: — <reason>` and listed
  in the evidence. *Proof:* `pnpm check:packs` exits 0 on the shipped tree with the local corpus, output pasted;
  `pnpm test` stays green (no test pins either item: grep for `D5.S1.q2`, `Return nectar`, `bee-agent-loop` in src, scripts, supabase finds none).

## Constraints → how met
- Offline and deterministic: corpus files only, no network (SC-4 corpus-absent run).
- No review reset from annotations: comments are outside `contentHash` (decided above). The two T0 text fixes DO
  change the hash of 2 items (Concern C-1).
- MF-0036 contract untouched: `checkCuckooFile` and its frozen test are not edited (`git diff` on both is empty at hand-off).

## Concerns
- **C-1 (owner: user, pack author).** The two T0 fixes change those items' `contentHash`, so their review state
  resets on the next `db:sync-keys`. Accept, or ship the gate with these two items annotated and fix them later.

## Iteration Log
- 2026-11-05 · pickup on `feat/MF-0033`. Read-only dry run: 50 hits, about 2 real (above). Proof-case replay:
  MF-0031 D2.S2 RED, MF-0031 D3.S3.q5 GREEN (rule cannot see it), MF-0038 D5.S2.q5 RED, MF-0038 D3.S3.q5 untestable.
  User chose narrow-then-build. Preflight: typecheck, lint, test 645/645, check:packs 0 problems; main CI `success` @ 629744a.
- 2026-11-05 · checkpoint 2: user approved SC-1…SC-5 and C-1 = fix both items now (accepts the 2-item review
  reset). Acceptance file frozen RED (7/7 `not implemented`). PLAN written; stage → build.
- 2026-11-05 · BUILD T1 (checker, 7/7 green) → T2 (wiring; first run 7 problems) → T3 (2 fixes + 4 `# framing:`;
  0 problems). TEST: typecheck 0, lint clean, 652/652, frozen hash OK, receipt DONE @ 62ad9ef7266d. → handoff.
