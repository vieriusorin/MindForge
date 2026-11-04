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

## Proof cases (from MF-0031 history)
- The pre-fix `packs/prod-prompting/diagrams/D2.S2.yaml` (`end_turn`) and the pre-fix `D3.S3` q5 option D ("never")
  must fail; the post-fix files must pass.
