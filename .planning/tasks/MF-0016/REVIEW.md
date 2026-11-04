---
verdict: approve
reviewed_hash: 12b277e547b2f6c2c92b9923c8dc4a83c9aa094bacd2bb1c021e7346c3e27147
reviewed_at: 2026-11-04T14:25:27Z
---
Scope: the paths in `mf0016-paths.txt` (scoped `git diff HEAD`, sha256 above, recomputed and matched).
Ignored per brief: src/dev-seed/**, scripts/dev-seed.ts, src/engine/questions/**, src/engine/content/level.ts,
packs/prod-prompting, MF-0031/33/34 files, the `level: LevelSchema.optional()` hunks in schema.ts.
Not re-reported (user-accepted): K-4 key lag, K-5 repeat answers.

Checked clean:
- (1) Key leak. page.tsx passes only `toPlayableCuckoo` output plus skill names to `CuckooSession`. The full
  `Cuckoo` stays in the server-side `session` array. `toPlayableCuckoo` picks fields one by one, with no
  flawLine, flawKind, explanation, author or generatedBy. The other `getPackContent` consumers (groups, walk,
  plant, review, flags) pass no raw `content` to a client component. Feedback is built only after
  `record_attempt` returns.
- (2) C-4. `checkCuckooAnswer` refuses `changed` when the deployed file hash (`getItemHashes`, the same raw-YAML
  hash as the sync) differs from the sent hash. An undefined file hash can never equal the sent hash (zod
  `min(1)`). The order is not-in-pack → withdrawn → changed → invalid-line, and the RPC runs only after `ok`.
- (3) Grading. The client sends `{packSlug, cuckooId, line, contentHash}`. The cuckoo is looked up in the server's
  own content for that pack, review state comes from the server, and `record_attempt` grades from the key row
  (pack and skill taken from the key). A question id sent as `cuckooId` returns not-in-pack, and the Duel
  cannot grade a cuckoo id. `record_attempt` and `question_keys` are unchanged.
- (4) Migration. It only swaps the check constraint to add `'cuckoo'`, with no grants change. No other SQL
  hard-codes the type list (the card-only analogy rule uses `<> 'card'`). `ITEM_TYPES` is updated in step.
- (5) Re-freezes. MF-0003 SC-5 now counts questions + cuckoos and still checks each question key. MF-0006 SC-6
  adds `cuckoos: []`. MF-0007 SC-1 adds the kind row. MF-0016 SC-5 moves the fixture date (a real defect: with
  R≈1 the skill dropped out of the top 5). None removes or loosens an assertion. All 8 file hashes match
  their FROZEN.json.
- Tests: `vitest run src/engine/content src/engine/memory src/features/cuckoo src/features/review src/lib` gives
  30 files and 126 tests green.

## Re-review (delta from a3c809d8… to fb763a26…, recomputed and matched)

I diffed the old and new scoped diffs line by line. The only changes are the fixes listed below. The
cuckoo and content tests pass (79).
- F1 resolved: D7.S2.yaml line 3 now reads "so Claude's file tools can't open it", which agrees with the
  permissions doc. Line 4 is the only flaw.
- F2 resolved: D7.S1 lines 4–5 are now neutral (`retention_days: 30`, `destination: app-logs`), and the
  explanation is tied to line 3 only.
- F3 resolved: the D6.S1 explanation now names the fork exception.
- F4 acknowledged: the frozen file is unchanged, and the hand-off names the existing Duel tests as the proof.
- F5: the C-3 wording in GOAL.md is aligned (GOAL.md is outside the scoped path list, so I did not hash it).
- F6 resolved: after a refusal the footer offers "Skip this snippet", which calls `next`.
  `__tests__/cuckoo-session.test.tsx` asserts focus moves to the next title and the action is called
  only once.
- [note, new] src/features/cuckoo/components/cuckoo-session/hooks/use-cuckoo-session.ts `isRefused` is true
  for every `!result.ok`, including `not-gradable`. `gradeCuckoo` also returns `not-gradable` when the RPC
  fails for a transient reason, so in that case the learner can no longer retry the snippet and can only
  skip it. A network failure (`mutation.isError`) still allows a retry. Nothing is recorded wrongly, so
  this is UX only.
- [note, new] src/features/cuckoo/components/cuckoo-session/cuckoo-session.tsx: the `nextLabel` choice is a
  small decision made in the view. It would sit better as a `utils.ts` function with a unit test
  (react-client-patterns). This does not block.

- Delta fb763a26… → 12b277e5… (recomputed, matched): the second new note above is resolved. The label
  decision is now `nextLabel({ isRefused, isLast })` in `utils.ts`, the view calls it, and
  `__tests__/utils.test.ts` covers all 4 combinations. No other change. The `not-gradable` retry note
  stays open and will be listed in the hand-off.

No blocking findings remain. Verdict: approve.

## Findings (first pass, hash a3c809d8…; all addressed above)

- [blocking] packs/ccdv-f/cuckoos/D7.S2.yaml:40 — cuckoo `ccdv-f.D7.S2.cuckoo-allow-beats-deny` has a second
  false claim besides the keyed line 4 (`flawLine: 4`). Line 3 says "We deny Read(./.env) so keys never enter
  the context." The cited source (code.claude.com/docs/en/permissions, "Read and Edit deny rules apply to
  Claude's built-in file tools, to file commands Claude Code recognizes in Bash… They don't apply to… arbitrary
  subprocesses that read or write files indirectly, like a Python or Node script") contradicts "never".
  Failure scenario: a learner who knows the source picks line 3, the DB grades it wrong, an incorrect attempt
  lands in D7.S2's FSRS memory, and the feedback teaches that line 3 is sound. This breaks the ticket's
  "exactly one planted flaw" premise (GOAL Objective, `Cuckoo` type doc). Fix: reword line 3 without the
  absolute, for example "so Claude's file tools can't open it".

- [note] packs/ccdv-f/cuckoos/D7.S1.yaml:38-41 — in `ccdv-f.D7.S1.cuckoo-log-full-prompts`, the harm spreads
  across lines 3, 4 and 5. The explanation itself blames "a shared, long-lived store" (`retention_days: 365`,
  `destination: shared-analytics-bucket`). A learner who picks line 5 has a defensible answer and is graded
  wrong. Consider making lines 4–5 neutral (an access-controlled store, short retention) so that line 3 alone
  carries the flaw, or tie the explanation to line 3 only.

- [note] packs/ccdv-f/cuckoos/D6.S1.yaml:16 — the explanation ("A subagent runs in its own context window,
  starting fresh") is right for ordinary subagents. The sub-agents doc names one exception: a fork inherits the
  parent conversation. The keyed line is still false as written ("never needs to restate"), so the answer key
  is sound. The explanation could say "unless it is a fork" so it is not contradicted by its own source.

- [note] src/engine/memory/__tests__/mf-0016-session.acceptance.test.ts:94 — the "Duel's picks unchanged" case
  compares `pickSessionItems` with `pickSessionQuestions`, which now delegates to `pickSessionItems`
  (src/engine/memory/select.ts). So it is tautological. The real proof of SC-5's second half is the existing
  Duel tests staying green. Nothing is broken, but don't cite this `it` as that proof.

- [note] src/features/cuckoo/components/cuckoo-session/components/snippet-lines.tsx:46 — C-3 says
  "`<pre><code>`". Lines are text nodes in `<code>` with `whitespace-pre-wrap` and no `<pre>`. The intent
  (inert text, never HTML) is met, and there is no `dangerouslySetInnerHTML`. The record should either match
  the wording or note this divergence.

- [note] src/features/cuckoo/components/cuckoo-session/cuckoo-session.tsx:120 — after a `withdrawn` or `changed`
  error the message says "Start a new round.", but the card offers only "Check answer", which re-sends the
  same refused answer. The learner has to leave through the sidebar. No attempt is recorded, so this is UX
  only. A "Skip"/"Next snippet" or a link back to `back.href` on those errors would match the wording.
