---
ticket: MF-0031
outcome: pass
causes: wrong-plan, known-trap-repeated, tooling
actions: gate, memory-update
applied: 2026-11-04
lesson_keys: ai-content-claims-outrun-source, shared-devtools-browser, parallel-session-coordination, design-preflight-sc-preconditions
---
## Numbers
`pnpm ticket:retro` is not in package.json, so these were gathered by hand from the artifacts. There are no session token metrics, so no token verdict is possible.
- Pack: 3 domains, 9 skills, 54 questions, 9 cards, 9 diagrams (72 items), all `origin: ai`. Iteration 0 only; FROZEN.json `history: []` (no refreeze).
- Freeze: 6 acceptance tests, all red for their own reason (ENOENT / `Unrecognized key: "level"`), then 6/6 green. Frozen hash unchanged.
- Verifiers (3 fresh-context, one per domain): OK 40, NOTE 13, FIX 19, all 19 resolved with keys unchanged.
- FIX rate by item type, counted from `verify/D*.md`: diagrams 6/9, cards 6/9, questions 7/54.
- Receipt: typecheck exit 0, lint clean, build exit 0. Full test run: 4 files / 8 tests failed, all MF-0016 in-flight work.
- SC-9: PARTIAL (diagram drawing not seen in a browser).

## Went right
- Per-domain forks, each writing a grounding note (item -> supporting passage), checked by a fresh-context verifier against the cached corpus text. The verifiers caught 19 real errors that the plausible-looking drafts hid: an inverted claim, a branch the cited page says is a workflow placed on the non-workflow side, a distractor that was arguably correct, and the `docs/MINDFORGE.md` §2.4 spec line that the MCP architecture page contradicts. The card was written true and the spec error was recorded in the evidence. — keep: already is, in `LOOP-PLAN.md` "Riskiest step" and `docs/plan/prod-prompting-validation.md`. Nothing new to write.
- All 15 sources were already in `.cache/corpus/` from MF-0008, so verification ran offline against the exact cited text. The ticket named that precedent in PLAN Discovery. — keep: already is, in LOOP-PLAN Discovery.
- Defaults for a dismissed intake dialog were applied and written under "Decided without a question", each marked as a reversible file edit. No rework resulted. — keep: already is, in the gsd-goal-loop autonomous reference.
- The shared-engine collision was handled: LOOP-PLAN Discovery named the overlap, the `level` hunks were kept additive, and the receipt attributed all 8 reds to MF-0016 by file name. The scope hash covered only MF-0031's own paths. — keep: already is, in the receipt format.
- When the browser was held, the ticket fell back to an HTTP render as a fresh learner ("72 in your queue", card rendered in full). It marked SC-9 `[~]` and listed the gap under "Not verified" rather than claiming a pass. The fallback recipe is not written anywhere (see Action 2).

## Went wrong
- Plausible but wrong claims came out of the drafting step at a 26% item rate (19 of 72). The patterns repeat across all three domains, so they are systematic, not random:
  - (a) A rationale, card line or diagram label states a fact or identifier that is not on the page cited for the item. Examples: D2.S2.q2 and D2.S2 diagram (`is_error`, `end_turn` are not on the cited overview page), D2.S3.q3 (URI, MIME, "passive"), D2.S1.q1 ("other vendors' APIs").
  - (b) An absolute or overclaiming quantifier that the page does not say. Examples: D3.S3.q5 ("never carry retry-after"; the page says "Not every 429 carries it"), D2.S1 card ("almost entirely", "hard contract"), D3.S3 card ("only the 429 is fixed by changing your own traffic").
  - (c) A diagram that drops a documented branch. Examples: D2.S1 diagram (the 400 case), D3.S1 diagram (evaluator-optimizer has no branch), D3.S3 diagram (402 and 504 uncovered).
  - Cause: wrong-plan. The plan relied on the verifier as the only net for claim-vs-source mismatches that are checkable mechanically. Part (a) and part (b) could have been flagged by a script before three verifier contexts spent their budget on them. The plan's own text, "plausible but wrong facts", named the risk but no cheap pre-check.
- The browser check for SC-9 failed for a reason that is already known. The shared chrome-devtools browser was held by another session's MCP instance, the same as MF-0003, MF-0004 and MF-0012 (`shared-devtools-browser`). The SC was written with "Proof: browser check" and no fallback, so it ended `[~]`. Cause: known-trap-repeated. The memory entry exists but it tells you how to behave once you hold the browser, not what to do when you cannot get it.
- The full suite was red for the whole ticket because an MF-0016 session was editing `src/engine/content/{schema,load-content,index}.ts` and `memory/select.ts` in the same worktree, with its in-flight reds in the shared run. MF-0031 handled it correctly (see Went right), but it cost a hand-attributed receipt. Cause: tooling and parallel-session coordination (`parallel-session-coordination`, seen in MF-0003/MF-0004). The ticket cannot fix this alone. The existing note on the branch (GOAL C-2: "worktree is on feat/MF-0016") shows the collision was foreseen and accepted.
- Scope note: the GOAL header says `branch: feat/MF-0016`, while the work belongs on `feat/MF-0031`. It was recorded as a Concern for the user, so it is not a defect.

## Actions (at most two)
1. gate: new script `scripts/check-pack-grounding.mjs`, wired as `pnpm check:packs` and added to the hand-off command list in `.claude/rules/testing.md` "Before hand-off" for tickets that touch `packs/**`. For every question, card and diagram of a pack, load the cached text of each cited source from `.cache/corpus/<sha256(url)>.json` (the same lookup MF-0008 used). Then:
   - **Error:** every backticked token or code identifier (`` `is_error` ``, `` `end_turn` ``, `` `strict: true` ``, HTTP status codes such as `402`/`504`, snake_case names) found in an option rationale, a card field or a diagram node/edge label must occur in the cached text of the source cited for that item. Tokens that appear in the same item's stem or options are exempt.
   - **Warning, which fails unless listed in an item's `# grounded:` comment:** the absolute quantifiers `never`, `always`, `only`, `almost entirely`, `all`, `hard contract` inside a rationale or `whereItBreaks` line when the cited text does not contain the same word.
   - Real files it would have caught: `packs/prod-prompting/questions/D2.S2.yaml` (`is_error` cited to the overview page, which does not contain it); the original D2.S2 diagram (`end_turn`); the original D3.S3.q5 distractor D ("never carry retry-after"); the original D2.S1 card ("almost entirely").
   - Skip with a clear message when `.cache/corpus/` is absent, so CI and fresh clones are unaffected.
   Would have saved: roughly 8 of the 19 FIX items (the unsupported-identifier and overclaim cases) before they reached three verifier contexts, and a re-run of each verifier on the fixed items. Part (c), missing diagram branches, still needs the verifier.
2. memory-update: `/Users/sorinvieriu/.claude/projects/-Users-sorinvieriu-Projects-mind-forge/memory/feedback-browser-verification.md`. Append this bullet after the "Other MindForge sessions" bullet:
   "- If the shared browser is already held by another session, do not wait on it and do not keep retrying. At the first refusal, mark the SC's browser proof `[~]` and run a substitute at once: fetch the page over HTTP as a fresh test learner with a session cookie, and assert on the rendered text (queue count, card fields). Record the exact part that was not seen (for example the React Flow drawing) under 'Not verified' in the evidence file; never promote the SC to a pass (MF-0031: HTTP render showed '72 in your queue' and the card, but the diagram drawing stayed unverified, SC-9 `[~]`). Write the SC's proof line to say 'browser check, or HTTP render if the browser is held' so the fallback is decided at the checkpoint, not at TEST."
   Would have saved: the time spent finding the fallback at TEST, and a PARTIAL that was a surprise instead of a planned outcome.

## Not worth changing
- The dismissed intake dialog. Defaults were recorded and reversible, and no rework resulted.
- The MF-0016 reds in the shared full-suite run. It is a known parallel-session cost, handled by attributing each failing file in the receipt. Adding a gate to isolate it would loosen the full-suite rule.
- Two questions with a second defensible answer (D1.S3.q6 option D, D3.S2.q4 option A). The verifier caught both, and a mechanical check cannot judge defensibility. The rule "a distractor must be wrong, not merely worse" belongs in the validation doc, which already lists the verifier and the reviewers.
- The MINDFORGE.md §2.4 MCP analogy ("only acts when a client calls it"). It is a spec error the user must edit, flagged in the evidence. Do not add an action.
- Diagram branch omissions (6 of 9 diagrams) have no static check. If the next pack ticket shows the same rate, add a "list every branch the cited page documents" line to the fork brief. One ticket is not a pattern.
- No `ticket:retro` script and no session token metrics were available. No token judgement was made.

## Applied
- Action 2 (memory-update): applied. Bullet added to `memory/feedback-browser-verification.md` after "Other MindForge sessions", with the HTTP-render recipe (helpers named).
- Action 1 (gate): held as a reserved ticket, never built. `.planning/tasks/MF-0033/GOAL.md` (MF-0032 was already reserved by MF-0016). Its `.claude/rules/testing.md` edit needs the user's approval when built.
