---
ticket_id: MF-0033
tier: normal                      # dev tooling: an offline content check; no app code, no DB
stage: intake
goal_status: reserved             # created by the MF-0031 retro (gate action); never built automatically
builds_on: [MF-0008, MF-0031]
---

> Reserved 2026-11-04 by the MF-0031 retro (Action 1). Not built until the user picks it up.

## Objective

**Today.** In MF-0031, 19 of 72 AI-drafted pack items needed fixes after a fresh-context verifier read them against the
cited docs. About 8 were mechanical: a rationale or label naming an identifier the cited page does not contain
(`is_error`, `end_turn` cited to the tool-use overview), or an absolute word the page does not say ("never carry
retry-after", "almost entirely").

**End state.** `pnpm check:packs` (`scripts/check-pack-grounding.mjs`) runs offline over every pack item and its cited
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
