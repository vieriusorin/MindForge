---
verdict: approve
verdict_detail: "Delta (U-7 key-rank rule): 0 blocker, 1 should-fix (filler padding in R-round distractors, against U-7 'without filler'; user call), 4 notes, 2 nits. Rank rule correct at every boundary (ties, official, multi-select, min-10, exactly 40%, ceil); SC-9 re-freeze honest. 30 of 64 R edits sampled (all 17 ccdv-f, all 8 key-text changes, all NOTE/FIX): keys correct, must-keep qualifiers intact, no distractor made true. Earlier: U-6 delta c40ff2db… approve; first review 285b256d… approve."
reviewed_hash: 1988fe6ec12139fc4f8eb862a2bb27719f31557921ebf9c51df684d045befcaa
reviewed_at: 2026-11-07T11:05:36Z
---

Reviewer: fresh-context diff-reviewer (did not build MF-0061). Worktree `mind-forge-MF-0061`, diff vs HEAD `660f1c1` plus
untracked files. Hash = `{ git diff HEAD -- . ':!.planning'; untracked outside .planning, sorted, cat }` | sha256.

## What I ran

- `pnpm check:packs`: exit 0. `key-length: 369 checked, 0 problem(s), 3 skipped (official), 5 multi-select not checked`;
  485 items, 0 token/leak problems (the corpus is present, 85 files).
- `pnpm vitest run` over the MF-0061 acceptance, MF-0044 acceptance and `key-length.test.ts`: 3 files, 21/21 pass.
- `shasum -a 256`: the MF-0044 acceptance file is `87ffbf84…`, which matches FROZEN.json `sha256`. HEAD's copy is `a80b26e5…`, which
  matches `history[0].previous`. The MF-0061 acceptance file is `3e5ebc76…`, which matches its FROZEN.json.
- An independent scope probe (my own script, HEAD YAML vs worktree YAML, parsed): 68 questions changed. 0 changes outside option
  `text`/`rationale` (no stem, source, level, origin, author, id, `correct` or top-level key changed). The three official
  items are unchanged. This confirms SC-5.
- MF-0060 plan-owns self-check (`check-planning.mjs` from the MF-0060 worktree against this tree): `gate:planning: 69
  ticket folders checked, ok`. No line names MF-0061. Every task is `inline`/`orchestrator`, and the owns cover every changed path.

## Gate change (check 1)

- `scripts/lib/key-length.mjs:122`: `isOfficial = item.origin === "official"`. This is an exact, case-sensitive match. The inner
  test proves that `ai`, `human`, `Official` and a missing origin are all length-checked (`key-length.test.ts` "checks every
  other origin"). The structure check still runs for official items (`compareLengths: false` returns only after the
  key-count, distractor and empty checks), as proven by SC-2's `found 2` case and the inner "malformed official" test.
- `GRANDFATHERED_PACKS` is deleted outright. No other pack-based skip remains: `checkKeyLengths` no longer takes `pack`,
  and the loop in `check-pack-grounding.mjs:57-73` visits every `PACKS/<pack>/questions/*.yaml`. The only caller is
  `check-pack-grounding.mjs:63`, and it is updated (the `pack` argument is dropped, `grandfathered` becomes `skippedOfficial`).
  No other reference to `GRANDFATHERED_PACKS` or `skipped (grandfathered)` remains outside `.planning` (grep).
- CONTEXT.md:16 does define `official` as "copied verbatim from the exam guide", and the field is "Fixed in the file; a review never
  changes it". So the exemption follows a domain rule; it is not an allowlist.

## Findings

1. **[should-fix, follow-up ticket] Choosing the longest option is still a strong tell after the retrofit.** The 1.15× ratio
   is met, but the key is still the longest option (ties included) in **42 of the 68** rewritten questions. Counted over whole packs
   (`select: 1`): ccdv-f went from 45/48 to **31/48**, prod-prompting from 49/54 to **39/54**, and platform-foundations from 14/54 to 12/54. For
   comparison, agent-skills is 0/54, ai-capabilities 3/48 and subagents 9/48. GOAL's Objective frames the defect as "a test-wise
   learner can … pick the longest option and be right", and the End state says "the key no longer stands out by length". That intent is only
   partly met: on the exam pack (ccdv-f, exam 2026-12-07), a learner who always picks the longest option still scores about 65%.
   Many keys sit at 1.03–1.08 (for example `ccdv-f.D8.S1.q1` 1.07, `prod-prompting.D1.S2.q4` 1.08). Each SC is satisfied as frozen,
   and the 1.15 threshold is the user's own decision (MF-0044 C-2), so this does not block the merge. Recommend a follow-up
   ticket: a pack-level rule such as "the key is the strictly longest option in ≤ ~40% of a pack's select-1 questions", or a
   per-question ratio closer to 1.0 for the exam pack. Raise it with the user rather than folding it in here.

2. **[note] The `origin: official` exemption trusts a field that any file author can set.** `OriginSchema`
   (`src/engine/content/origin.ts:4`) accepts `official` in any pack and for any id. The only constraint is that it has no `author`
   (`origin.ts:14`). Nothing ties `official` to an Exam Guide source, a `.official-N` id or the ccdv-f pack. If someone marked a
   new item `official` without an author, it would also skip the key-length rule. The incremental risk is small, though, for two reasons:
   (a) the same mislabel already gives a far bigger bypass, because official items start `approved` and skip the human review
   (`src/engine/content/review.ts:46`). (b) The frozen MF-0061 SC-3 pins `3 skipped (official)` on the repo, so a fourth official
   item turns `pnpm test` red. That works as a tripwire. A possible hardening for later, not in scope here: the schema could
   require official items to cite the Exam Guide source or use an `*.official-<n>` id.

3. **[note] MF-0044 re-freeze (C-2): minimal and honest, but the user has not yet approved it.** The diff of
   `mf-0044-key-length.acceptance.test.ts` touches only the header comment, SC-3 (the title, plus the `prod-prompting` 150/100
   fixture, which now expects the 1.50× problem and `1 checked, 1 problem(s), 0 skipped (official)`) and SC-6 (the title plus the
   regex `skipped \(grandfathered\)` changed to `skipped \(official\)`). SC-1, SC-2, SC-4 and SC-5 have no hunks, so the claimed byte-identity holds. Both changes are
   forced by U-4, because the fixture's slug is one of the three packs removed from the set. The `history` entry exists, records the
   previous hash, and says plainly "Approval: orchestrator (U-2) at the pre-merge review; not yet confirmed by the user". This
   review is not the user's consent. The GOAL lists C-2's owner as "orchestrator (U-2) / user", so the hand-off should still put the
   re-freeze in front of the user.

4. **[note] `ccdv-f.D7.S1.q1` key softens the page's security qualifier** (`packs/ccdv-f/questions/D7.S1.yaml:42`). The new key
   ends "…state in the system prompt that tool content is untrusted data, not instructions." The old key said "must never override
   instructions". The page (mitigate-jailbreaks) says: "Tell Claude explicitly that content returned from tools, documents, or
   searches is untrusted data and **must never override the system prompt or the user's original request**." The page's own example
   policy ("information to report, not commands to follow") does ground the new wording, so the key is still correct. Still, the strictest
   phrasing on the page is "must never override", and the rewrite dropped it to save length. The verifier (G3) proposed the same
   wording. Optional fix: "…that tool content is untrusted data that must never override instructions." (about +10 chars; the ratio
   would still be under 1.15).

5. **[note] Absolute words appear only in distractors, a tell the rewrites kept or widened.** In `ccdv-f.D5.S3.q2`
   (`D5.S3.yaml:28`) the distractors say "strictly better … fully backward compatible", "any workload or prompt set" and "indefinitely … any
   behavior change", while the key has no absolutes. `ccdv-f.D2.S5.q1` C says "always lead Claude to copy". `ccdv-f.D5.S3.q1` A/C say "guarantee", "Any". The G2
   verifier recorded this as pre-existing. It is the exact tell the GOAL's Constraints name ("no absolute words added to
   distractors only"). The rewrites lengthened these distractors without adding new absolutes, so this is not a regression, but a test-wise
   learner can still exploit the pattern. Worth feeding into the follow-up in finding 1.

6. **[note] `ccdv-f.D6.S3.q2` key overstates the guarantee, as it did before the rewrite** (`D6.S3.yaml:39`). The key says "enforce it with a Stop hook so the turn
   cannot end until it passes". The page (best-practices) says "the turn doesn't end until the typecheck passes **or the block
   limit**…". The rewrite kept the old claim and only trimmed "actually". The key is still the best answer, but it leaves out the page's
   qualifier.

7. **[note] `prod-prompting.D1.S2.q4` key echoes the stem** (`D1.S2.yaml:93`). The key is "low, the most efficient level, which the effort table
   suggests for simple, cost-sensitive work like subagents". The stem says "short, simple subagent calls. Latency and cost matter". The key
   is the only option that repeats "simple" and "cost", although C also repeats "subagents". It is grounded in the effort table ("Simpler tasks that need the best
   speed and lowest costs, such as subagents"). This is mild, and it is also the longest option, at 1.08.

8. **[nit]** GOAL "Facts" and the evidence say "2 official items", but SC-3 and the checker count **3** official items (`ccdv-f.D2.S3.official-1`
   is official but was never flagged). SC-3 states this correctly. The prose in the Objective ("The two `origin: official` questions")
   could say "the two flagged official questions" to avoid misleading the next reader.

No finding on the other checks. Tests prove intent: SC-1 covers all three slugs, SC-2 covers both the skip and the structure path,
the inner test covers case and missing origin, and SC-4 is a literal key map with 68 entries. No figure, RBAC or UI surface is touched.
The DB proof (SC-7) is recorded in LOOP-VERIFY. I did not re-run it, because DB access needs the lock.

## Questions sampled (40; source page read in `.cache/corpus` for each claim checked)

| Item | Ratio | Key correct + grounded | Distractors still wrong | New tell? | Verdict |
|---|---|---|---|---|---|
| ccdv-f.D1.S1.q1 | 0.97 | routing workflow (building-effective-agents) | yes | no | OK |
| ccdv-f.D1.S1.q2 | 0.99 | orchestrator-workers | yes (C gained "gate checks", still fixed sequence) | no | OK |
| ccdv-f.D1.S2.q1 | 1.01 | Agent SDK | yes | no | OK |
| ccdv-f.D1.S3.q1 | 1.04 | build directly on the LLM API | yes | no | OK |
| ccdv-f.D1.S3.q2 | 1.00 | structured note-taking | new D refuted: "clearing tool calls and results … why would the agent need to see the raw result again", context rot | no | OK |
| ccdv-f.D2.S1.q2 | 1.02 | multidimensional criteria incl. privacy metric | yes | no | OK |
| ccdv-f.D2.S2.q2 | 0.94 | Usage CSV by API key and model | yes | no | OK (thin B refutation, pre-existing) |
| ccdv-f.D2.S3.q1 | 1.01 | custom_id, resubmit expired, fix invalid | B now shares custom_id but resubmits invalid unchanged: still wrong | no | OK |
| ccdv-f.D2.S3.q2 | 0.94 | streaming / batches | yes | no | OK |
| ccdv-f.D2.S4.q1 | 1.02 | POST not guaranteed idempotent (MDN) | B premise "GET is safe and idempotent" true, conclusion wrong | no | OK |
| ccdv-f.D2.S5.q1 | 1.06 | XML tags, long doc at top | yes | C "always" (finding 5) | OK/note |
| ccdv-f.D2.S6.q2 | 1.02 | pinned snapshot in reviewed config | yes | no | OK (thin grounding, pre-existing, G1) |
| ccdv-f.D4.S1.q1 | 1.03 | 529 backoff, fix 400s | yes | no | OK |
| ccdv-f.D4.S1.q2 | 1.04 | tool_result blocks first | yes | no | OK |
| ccdv-f.D5.S1.q1 | 1.03 | everything counts; token counting API | C: "all three count toward the window" refutes it | no | OK |
| ccdv-f.D5.S1.q2 | 0.93 | effort low; default is high/medium, not the cheapest | A/B/D wrong per effort page | no | OK |
| ccdv-f.D5.S2.q1 | 1.01 | SDK retries with backoff, honors retry-after | D rationale: page recommends TCP keep-alive | no | OK |
| ccdv-f.D5.S3.q2 | 1.00 | breaking changes + own evals | yes | absolutes only in distractors (finding 5) | note |
| ccdv-f.D5.S4.q1 | 0.99 | breakpoint at end of static prefix ("place the breakpoint at the end of the static prefix, not on the varying block") | C "up to four" grounded, still misses | no | OK |
| ccdv-f.D6.S1.q2 | 1.01 | subagent, own context, returns summary | yes | no | OK |
| ccdv-f.D6.S3.q2 | 0.99 | Stop hook exit 2 | yes | no | note (finding 6) |
| ccdv-f.D7.S1.q1 | 0.99 | tool_result, JSON, source label, policy | D refuted: "Don't put your own instructions in tool results" | key echoes "deliver" (mild) | note (finding 4) |
| ccdv-f.D7.S2.q1 | 1.06 | Haiku pre-screen, structured output, refusal = harmful | yes | no | OK |
| ccdv-f.D7.S3.q1 | 0.95 | PreToolUse exit 2 | D refuted: "PermissionRequest … Exit code 2 isn't honored … proceeds unchanged" | no (all four now parallel, good) | OK |
| ccdv-f.D7.S4.q1 | 0.96 | Workload Identity Federation | C grounded ("belongs to the workspace"), still a static secret | no | OK |
| ccdv-f.D8.S1.q1 | 1.07 | "at least 3–4 sentences", service prefix | B rationale grounded ("Not every model and setting supports forced tool use") | no | OK |
| ccdv-f.D8.S2.q1 | 1.01 | Streamable HTTP, "ideally" OAuth kept (page: "MCP recommends using OAuth") | D: page names two transports, no WebSocket | no | OK |
| ccdv-f.D8.S3.q1 | 1.05 | Skill with description + supporting files | C/D refuted by the skills table ("disable-model-invocation: true … Description not in context"; default "Description always in context") | no | OK |
| ccdv-f.D8.S3.q2 | 0.99 | web search server tool | B (bash client tool) refuted: client tools run in your application | no | OK |
| prod-prompting.D1.S1.q4 | 1.01 | docs at top, `<document>`/`<source>` | yes | no | OK |
| prod-prompting.D1.S2.q4 | 1.08 | effort low ("such as subagents") | D refuted: default is high/medium | stem echo (finding 7) | note |
| prod-prompting.D1.S3.q5 | 1.04 | refusal / max_tokens | A rationale fixed (G4 FIX) and now accurate | no | OK |
| prod-prompting.D2.S1.q2 | 0.95 | detailed descriptions | yes | no | OK |
| prod-prompting.D2.S2.q1 | 0.97 | user message with tool_result + tool_use_id | yes | no | OK |
| prod-prompting.D2.S3.q6 | 1.06 | toolsListChanged → list_changed → tools/list | C/D unrefuted by sentence, false in practice (G5 NOTE) | no | OK |
| prod-prompting.D3.S2.q1 | 0.99 | context rot | yes | no | OK |
| prod-prompting.D3.S2.q2 | 1.02 | all of it incl. output | C refuted: cache_read "count toward the window" | no | OK |
| prod-prompting.D3.S3.q5 | 0.98 | tier spend cap | A no longer states "two retries" (G5 FIX folded) | no | OK |
| platform-foundations.D1.S1.q4 | 0.96 | define format + example | yes | no | OK |
| platform-foundations.D4.S1.q2 | 0.98 | capabilities, speed, cost, effort | yes | no | OK |

## Delta review (U-6 rebalance)

Reviewer: a fresh-context diff-reviewer that did not build MF-0061 or write the first review's verdict. Hash `c40ff2db…24a` (same
recipe as above), reviewed 2026-11-07T10:31:55Z. Scope: the U-6 additions only. That means `longestKeyShareProblem` /
`LONGEST_KEY_SHARE_LIMIT`, the summary line in `check-pack-grounding.mjs`, the new inner tests, the frozen SC-9 file, the 46
rebalance edits, and the MF-0044 history wording.

### What I ran

- `pnpm check:packs`: exit 0. `key-length: 369 checked, 0 problem(s), 3 skipped (official), 5 multi-select not checked;
  longest-key: 7 pack(s) checked, 0 problem(s)`.
- vitest on the MF-0061 retrofit and share acceptance files, the MF-0044 acceptance file and `key-length.test.ts`: 4 files, 28/28
  pass.
- Frozen hashes, LF-normalised: `3e5ebc76…2497` (MF-0061 retrofit), `c44c4aa3…bb` (MF-0061 share) and `87ffbf84…ace2` (MF-0044).
  All three match FROZEN.json. The MF-0044 `history[0]` keeps `previous: a80b26e5…` and now reads "approved by the user
  2026-11-07 (MF-0061 U-5)", which agrees with GOAL U-5 and C-2 "resolved".
- **SC-9 RED for the right reason.** I extracted HEAD `660f1c1` to a scratch dir, copied in only the frozen share test and
  ran it: 4 failed. The failures were `expected +0 to be 1` (the 2-of-3 pack exits 0), the stdout lacking `longest-key: 1 pack(s)
  checked, 0 problem(s)` (×2), and the repo stdout not matching `/longest-key: …/`. That is identical to FROZEN.json `first_failure`.
  The fixtures also discriminate. If ties counted, the message would read "3 of 3", not "2 of 3". If officials counted, the
  official fixture would be 2/3 and fail. If multi-select counted, that fixture would be 1/2 and fail, because its select-2 options are
  [110✓, 110✓, 10, 10].
- **Isolating the 46 edits.** I used my own parser (scratchpad `mf0061-review/delta.mjs`), comparing scratchpad
  `mf0061/pre-u6/` with the worktree. It found exactly 46 changed questions (ccdv-f 12, prod-prompting 24, claude-code-in-action
  10). Nothing changed outside option `text`/`rationale`, and no `correct` flag moved. I checked that the snapshot is faithful:
  claude-code-in-action, agent-skills and subagents in `pre-u6` are byte-identical to HEAD.
- I recomputed the shares independently (select 1, non-official, strict): ccdv-f 11/45, prod-prompting 13/54, claude-code-in-action
  16/66 (all 24%), platform-foundations 12/54, subagents 6/48, agent-skills 0/54, ai-capabilities 0/48. These match LOOP-VERIFY.
- MF-0060 plan-owns self-check (MF-0060's `check-planning.mjs` against this tree): `gate:planning: 69 ticket folders checked,
  ok`, and no line names MF-0061. T5 (`inline`) owns `scripts/lib/key-length.mjs`, `scripts/check-pack-grounding.mjs` and both test files. T6
  (`inline`) owns the three `packs/*/questions/**` globs, including claude-code-in-action. Inline tasks owning `scripts/**` and
  `packs/**` are allowed by rule 2. Every changed path is covered.

### Rule (check 1)

- `scripts/lib/key-length.mjs:106`: `keyLongest * 100 <= LIMIT_PERCENT * checked` is an integer comparison, so 7/20 passes and 8/20
  fails with no float edge. `checked === 0` passes. The strict `>` at `:87` means ties don't count. Officials return
  `isKeyLongest: false` and sit outside `checked` (`:164-166`). Multi-select `continue`s before both counts (`:160`). A malformed question
  is in `checked` but never in `keyLongest`, and it fails on its own anyway. The message names the pack, k, n, % and the limit, as SC-9
  requires. The rule runs once per pack directory with a `questions/` folder (`check-pack-grounding.mjs:59-84`), so every pack is
  covered.

### Findings

1. **[should-fix, for the user to decide] The rebalance moved the length tell from rank 1 to rank 2 in prod-prompting rather than
   removing it.** The method lengthens one distractor until it is just past the key. That makes the key the **second-longest** option
   in a pattern a test-wise learner can use. Here is where the key ranks by length among the options (select 1, non-official; rank 1
   includes ties), from `pre-u6` to now:
   - prod-prompting: rank 1 went 72% → 28%, but rank 2 went **22% → 67% (36/54)**. The key is in the top two by length in **95%**
     of questions, and it is never the shortest.
   - ccdv-f: rank 1 went 64% → 38% (11 strict plus 6 ties), and rank 2 went 18% → 44%. The top two cover 82%.
   - claude-code-in-action: rank 1 went 52% → 36%, and rank 2 went 9% → 24%. This pack is fine.

   So in prod-prompting, "pick the second-longest" now scores about 67% against 25% for chance. SC-9 and SC-10 are met as frozen,
   because U-6's metric counts only the strictly longest. But GOAL's intent ("the key no longer stands out by length") is not met for
   that pack. The margins are thin, too. Typical edits leave the distractor 2–10% longer than the key (for example
   `claude-code-in-action.D2.S1.q1` 102 against 99, and `prod-prompting.D1.S3.q2` 100 against 91). The user should see this before
   merge. Options: accept it as is, or have a follow-up add a rank-spread rule, such as "key in the top two by length in ≤ ~60% of a
   pack". It is not a blocker, because the rule shape was the user's own decision (U-6).
2. **[note] The failure message can print a share that equals the limit.** `scripts/lib/key-length.mjs:107` rounds the share for
   display, so 6 of 17 (35.29%) fails with `…(35%, limit 35%)`, and so does 351 of 1000. A reader then sees a failure at a share
   the rule says passes. I checked both cases with `longestKeyShareProblem`. Fix: use `Math.ceil`, or print one decimal. No frozen
   test pins a non-integer case, so this is free to change.
3. **[note] Small packs fail on their first question.** A pack with 1 checked question whose key is longest is at 100% and fails
   `check:packs`, and 1 of 2 is at 50% (`:106` has no minimum n). This follows U-6 ("applies to every pack"). Still, anyone drafting a new
   pack question by question will hit it at once, and the message gives no hint that the cause is the small sample. Worth a sentence
   in the authoring docs, or a minimum n in a follow-up.
4. **[note] A cross-question "bigger model" distractor pattern was reinforced.** The H1 edit to `packs/ccdv-f/questions/D4.S1.yaml:22`
   added "more capable". Now "Switch to a larger, more capable model…" opens three ccdv-f distractors (`D4.S1.yaml:22`,
   `D1.S3.yaml:14`, `D7.S1.yaml:63`), and two more carry the same idea (`D4.S1.yaml:35`, `D7.S1.yaml:21`). The key is never "upgrade the
   model". The edit is grounded and still wrong per the errors page, but it sharpens a pack-wide tell.
5. **[note] Padding that reads as padding.** None of these makes an option true, but each phrase is filler:
   - `prod-prompting/questions/D1.S1.yaml:75`: "…spoken answer instead" ("Move … into … instead" is redundant).
   - `prod-prompting/questions/D1.S1.yaml:145`: "…the rest of the prompt exactly as it is".
   - `prod-prompting/questions/D3.S3.yaml:149`: "…inside each tool result, beside the page, …".
   - `ccdv-f/questions/D8.S2.yaml:22`: "authenticated network access" echoes the stem (H1 already noted this).
   - `claude-code-in-action/questions/D2.S5.yaml:115`: "project-scoped `.mcp.json`", where every `.mcp.json` server is project-scoped.

   They are mild, and none is in the key. They matter mainly together with finding 1: the longest option is often the one
   with a tacked-on clause.
6. **[note] C-3 and Affected do not cover the U-6 scope.** `GOAL.md:64-67` (Affected) still lists 68 questions and three packs.
   `GOAL.md:165` (C-3) accepts content-hash churn for the 68. U-6 adds 46 edits (85 distinct questions changed, 29 overlapping) and
   brings claude-code-in-action in, so 10 of its items get new versions too, which voids in-flight attempts and old approvals
   (MF-0032 / MF-0007). U-6 implies acceptance, but the hand-off should say "85 questions in 4 packs".
7. **[nit]** `src/test/__tests__/key-length.test.ts:243`: the test named "does not count a malformed question toward either side"
   asserts only `keyLongest`. The malformed question is in `checked`, which is the denominator. Rename it, or assert `checked: 1`.
8. **[nit]** The first review's finding 1 numbers (42/68, 31/48, 39/54) counted ties and officials. GOAL Facts (`:55`) already
   says so. No action needed.

### Rebalance edits sampled (24 of 46; each changed option read against the cited page in `.cache/corpus`)

The sample includes all 7 NOTE and all 4 FIX items from verify/H1–H4. ✓ = still clearly wrong per the page, no new truth-tell, key
unchanged and correct, and the rationale gives the page's reason.

| Item | H verdict | Changed option (len vs key) | Page says (quoted) | Result |
|---|---|---|---|---|
| ccdv-f.D2.S3.q1 | NOTE | B "+ since both failure types are transient" (144 vs 132) | batch-processing: "invalid_request_error … # Request body must be fixed before re-sending request" | ✓. The new clause is the false premise, and the rationale says so |
| ccdv-f.D1.S2.q1 | NOTE | A "+ the" ×2 (155 vs 149) | agent-sdk: Client SDK "You write the tool loop yourself" | ✓. Pure padding (finding 5 class) |
| ccdv-f.D6.S2.q1 | FIX→folded | C "+ and MUST … rules" (125 vs 111). New rationale cites the ellipses example | best-practices: "**Less effective:** NEVER use ellipses **More effective:** … read aloud … Claude can generalize from the explanation" | ✓. The fold now cites the right section |
| ccdv-f.D4.S1.q1 | OK | D "+ more capable" (138 vs 128) | errors: 529 "temporarily overloaded"; 400 "issue with the format or content" | ✓, but finding 4 |
| ccdv-f.D5.S1.q1 | OK | C "+ all the … 400" (158 vs 154) | context-windows: "`input_tokens`, `cache_read_input_tokens`, and `cache_creation_input_tokens`, and all three count toward the window" | ✓ |
| ccdv-f.D5.S2.q1 | OK | C "+ on a 429" (165 vs 157) | errors: SDK "retries … with exponential backoff … honoring the `retry-after` header" | ✓ |
| ccdv-f.D8.S2.q1 | OK | D "+ network" (126 vs 119) | architecture: "MCP supports two transport mechanisms: Stdio … Streamable HTTP" | ✓. Stem echo (finding 5) |
| ccdv-f.D7.S1.q2 | OK | B "tool access" → "database tool access" (145 vs 138) | mitigate-jailbreaks: least privilege, "scope permissions as narrowly as possible" | ✓ |
| ccdv-f.D2.S6.q2 | OK | B "+ latency" (133 vs 126) | models overview: pinned snapshot | ✓. Natural |
| prod-prompting.D1.S1.q4 | FIX→folded | D "for long inputs" → "for 20k+ token inputs" (108 vs 103), with "even" removed | best-practices: "large documents or data-rich inputs (20k+ tokens) … Put long-form data at the top" | ✓. Uses the page's own threshold as a lure. No "even" left |
| prod-prompting.D1.S1.q5 | FIX→folded | C "…assistant messages in earlier turns … also return a 400 error" (134 vs 126) | best-practices: "adding assistant messages elsewhere in the conversation is not affected" | ✓. Directly refuted. No "even"/"anywhere" |
| prod-prompting.D1.S3.q3 | FIX→folded | A "…retry the call until the fields come back in schema order" (122 vs 105) | structured-outputs: "required properties appear first … mark all properties as required, or account for this reordering in your parsing logic" | ✓. The remedy is no longer the documented one. +16% is the biggest gap sampled |
| prod-prompting.D1.S3.q5 | NOTE | A "+ writing" (100 vs 96) | structured-outputs lists refusal and max_tokens; "end_turn" absent from the page | ✓. Thin grounding, pre-existing |
| prod-prompting.D2.S1.q1 | NOTE | C "+ HTTP API" (93 vs 85) | define-tools: the param table is `name`, `description`, `input_schema`, `input_examples` | ✓. Indirect refutation |
| prod-prompting.D3.S1.q5 | NOTE | C "+ having a human review only the final result" (108 vs 98). Rationale extended | building-effective-agents: "ground truth from the environment at each step … pause for human feedback at checkpoints" | ✓ |
| prod-prompting.D3.S3.q3 | OK | A "+ inside XML tags" (104 vs 93) | mitigate-jailbreaks: "Deliver third-party content … inside `tool_result` blocks, never in `system` prompts"; an attacker "cannot close a quote or tag to 'break out'" | ✓. XML tags don't rescue the system-prompt placement |
| prod-prompting.D3.S3.q6 | OK | C "instructions" → "reminders, beside the page" (113 vs 101) | mitigate-jailbreaks: "Don't put your own instructions in tool results … Send your instructions in a `user` turn" | ✓. Padding (finding 5) |
| prod-prompting.D3.S2.q2 | OK | C "cache reads and cache writes are both left out" (110 vs 107) | context-windows: "all three count toward the window" | ✓ |
| prod-prompting.D3.S2.q5 | OK | D "+ or open bug" (121 vs 112) | effective-context-engineering: compaction "preserves architectural decisions, unresolved bugs" | ✓. Page vocabulary as a lure; still wrong (summarise only the system prompt) |
| prod-prompting.D1.S3.q6 | OK | D "+ including case" (110 vs 97) | structured-outputs: "This applies to both JSON outputs and strict tool use" | ✓ |
| prod-prompting.D1.S1.q3 | OK | D "+ spoken … instead" (122 vs 114) | best-practices: explained rule is "More effective"; "Include 3–5 examples" | ✓. Padding (finding 5) |
| claude-code-in-action.D2.S1.q1 | NOTE | A "+ and current" (102 vs 99) | setup: version, then `claude doctor` | ✓ |
| claude-code-in-action.D2.S6.q2 | NOTE | D "a schedule" → "its default schedule" (101 vs 95) | github-actions: "Interactive mode: when the workflow provides no `prompt` input, Claude waits for the trigger phrase" | ✓. "default schedule" is invented but plainly false |
| claude-code-in-action.D2.S5.q5 | OK | A "+ project-scoped" (124 vs 111) | mcp page (key unchanged) | ✓. Tautological padding (finding 5) |

I also read, without quoting them in the table: claude-code-in-action D2.S2.q5 A (permissions order), D2.S3.q1 C (interactive-mode:
"`Esc` … Claude keeps the work done so far"), D3.S2.q2 A (hooks: `PreCompact` matchers `manual`, `auto`) and D2.S6.q4 B
(github-actions: "GitHub doesn't trigger workflows on commits made with the default `GITHUB_TOKEN`"). All ✓.

No absolute word ("always", "never", "even", "guarantee") was added to a distractor in the 46. No key text changed. No hedge was added to a
key.

### Delta verdict

approve. There are 0 blocking findings. Finding 1 should go to the user with the hand-off (the rank-2 shift in prod-prompting),
together with the opposite-tell follow-up GOAL already reserves. Pre-u6 also has agent-skills with the key as the **shortest** option in 54% of
questions, a tell of the same kind as finding 1, so it belongs in that follow-up as well.

## Delta review (U-7 key-rank rule)

Reviewer: a fresh-context diff-reviewer that did not build MF-0061 or write either earlier verdict. Hash
`1988fe6e…caa` (same recipe), reviewed 2026-11-07T11:05:36Z. Scope: the U-7 additions. That means `keyRanks` /
`keyRankProblems` / `KEY_RANK_LIMIT` / `KEY_RANK_MIN_QUESTIONS`, the summary line, the inner tests, the re-frozen
SC-9 file, and the 64 R1–R5 edits.

### What I ran

- `pnpm check:packs`: exit 0. `key-length: 369 checked, 0 problem(s), 3 skipped (official), 5 multi-select not checked;
  key-rank: 7 pack(s) checked, 0 skipped (< 10 questions), 0 problem(s)`.
- vitest on the MF-0061 retrofit and share acceptance files, the MF-0044 acceptance file and `key-length.test.ts`: 4 files, 29/29 pass.
- Frozen hashes, LF-normalised: `3e5ebc76…2497` (retrofit), `dedda698…007f` (share, re-frozen for U-7) and `87ffbf84…ace2`
  (MF-0044). All three match their FROZEN.json. The `history[1]` entry for the share file records `previous: c44c4aa3…`,
  which is the hash the U-6 delta review verified. Its reason cites U-7 and describes the contract change accurately.
- **SC-9 RED for the right reason.** I reasoned this through; I did not execute it. The U-6 code was never snapshotted:
  scratchpad `pre-u7/` holds packs only. Under the U-6 rule (strictly-longest share ≤ 35%, no minimum n) each of the
  five frozen cases fails in the way FROZEN.json `first_failure` says:
  - the rank-2 5/10 pack has 2/10 strictly longest, so it exits 0;
  - `short` has 2/10 strictly longest and `tied` has 0/10, so both exit 0;
  - the 4/10-longest pack is 40% > 35%, so it exits 1 where 0 is expected;
  - `small` is 9/9 = 100%, so it fails where a skip is expected;
  - the repo stdout has no `key-rank:` line.

  The fixtures also discriminate the new rule. A rule that ignored ties would print `tied` as 0 longest. A rule that
  counted officials would make `mixed` 8/15 longest. A rule without the minimum would fail `small`.
- **Isolating the 64 R edits.** I wrote my own parser (scratchpad `mf0061-review3/delta.mjs`) and compared scratchpad
  `mf0061/pre-u7/` with the worktree. It found exactly 64 changed questions: agent-skills 12, ai-capabilities 10, ccdv-f 17,
  prod-prompting 25. There were 0 violations: nothing changed outside option `text`/`rationale`, and no option id or
  `correct` flag moved. The snapshot is faithful: claude-code-in-action, platform-foundations and subagents in `pre-u7` are
  byte-identical to the worktree. Against HEAD, 111 questions changed in 6 packs (38/39/12/10/10/2), with 0 violations.
  That matches the SC-5 probe and the evidence.
- The rank distribution I recomputed matches LOOP-VERIFY and the evidence. MF-0060 plan-owns self-check (MF-0060's
  `check-planning.mjs` against this tree): `gate:planning: 69 ticket folders checked, ok`, and no line names MF-0061. T5
  (`inline`) owns the rule, the summary and both test files. T6 (`inline`) owns all five edited `packs/*/questions/**`
  globs. The MF-0044 FROZEN.json is exempt.

### Rule (check 1)

- **Rank:** `scripts/lib/key-length.mjs:98-99` computes `1 + distractors strictly longer than the key`, so a tie shares the
  better rank. Proven by inner `[100,100,90,80]` → longest, and by the frozen `tied` pack.
- **Exclusions:** officials return `keyRank: null` before ranking (`:96`) and sit outside `checked` (`:183-185`).
  Multi-select `continue`s first (`:179-182`). A malformed question is in `checked` but has no rank (inner test asserts
  `checked: 1`, so U-6 note 7 is fixed). That dilutes the denominator, but such a question fails `check:packs` anyway.
- **Boundary:** `count * 100 <= 40 * checked` is integer math, so 4/10 passes (frozen + inner). The printed share is
  `Math.ceil`. Fail implies a true share > 40 by at least 1/n, so it can never print `40%`. I probed 7/17 → `42%`,
  9/22 → `41%`, 401/1000 → `41%`. U-6 note 2 is fixed.
- **Minimum:** `checked < 10` returns `[]`, and the checker counts the pack as skipped (`check-pack-grounding.mjs:84-85`).
  9 passes and 10 is checked (frozen `small`, inner `checked: 9`).
- **Option count:** every shipped select-1 question has 4 options (369/369, counted). 3-option questions don't exist yet.
  See finding 3 for the latent naming gap.

### Findings

1. **[should-fix, user call] Many R-round distractor edits are filler padding, against U-7 "near-uniform spread without
   filler".** None makes a distractor true, and length is no longer a tell (every rank ≤ 36%). But a padded clause reads as
   padding, and in ccdv-f (the exam pack) roughly 12 of the 17 R edits lengthen a distractor with words that change nothing:
   - `packs/ccdv-f/questions/D6.S1.yaml:10,14,22`: each of the three distractors gains about 15 chars ("can remain in the
     history", "of the session", "which of the early tool results").
   - `D2.S3.yaml:34` ("has to be rerun as a single unit") and `D2.S3.yaml:46` ("can no longer be resubmitted").
   - `D5.S4.yaml:22` ("the part that gets written") and `D6.S3.yaml:47` ("comes out above 8").
   - `D8.S2.yaml:10` ("so that remote clients"), `D8.S3.yaml:46` ("the full … already has them") and `D8.S3.yaml:71`
     ("to the request through").
   - `D1.S3.yaml:10` ("without having to read the raw prompts").
   - In prod-prompting, `D3.S3.yaml:37,41` grow 59 → 90 and 59 → 82 ("and keep sending until one of the requests gets
     through", "stop retrying and show the user an error message").

   The verifiers checked grounding and truth, not filler, so none flagged these. Options: accept as is (they are
   harmless to correctness), or have a light follow-up pass that replaces filler with plausible content. Not a
   blocker.
2. **[note] The absolute-only-in-distractors tell remains at about 40% in prod-prompting (pre-existing, slightly
   improved).** Tell-scan table below. prod-prompting has a distractor with always/never/only/cannot/must while the key
   has none in 22/54 (41%), or 21/54 (39%) if `all` is counted as an absolute. ccdv-f is 14–17/45 (31–38%). At HEAD these
   were 48% and 38–44%. This is an elimination aid, not a key-picker, and the GOAL constraint only forbids *adding* such
   absolutes. I found none added by the R edits: ai-capabilities `D3.S2.q5` A even had its "can no longer succeed" removed
   (R2 FIX). Strong remaining instances:
   - `ccdv-f.D5.S3.q2` (`D5.S3.yaml`): A "strictly better … fully", C "any workload", D "indefinitely … any", against a
     key with no absolutes.
   - `ai-capabilities.D2.S1.q5` and `D3.S2.q6`: hedges in the key ("can be unfaithful … sometimes", "reduce … do not
     remove") and absolutes in the distractors ("must", "whenever", "only", "prove").

   Belongs in the follow-up the earlier reviews reserved.
3. **[note] Rank naming assumes 4 options; the schema allows 2–6** (`src/engine/questions/schema.ts:41`,
   `scripts/lib/key-length.mjs:29-33`). This is latent, because all 369 checked questions have 4 options. With other counts:
   - In a 5- or 6-option question, rank 4 is printed "shortest" although it isn't.
   - The shortest of a 3-option question is printed "3rd longest".
   - A pack made of 2-option questions can never pass, because one of its two ranks always holds ≥ 50%.

   The code comment acknowledges the first point. If questions with other option counts ever ship, name ranks relative
   to the option count, or exclude non-4-option questions with a count.
4. **[note] Pattern-distractor families: "bigger model" is fixed, "larger context window" and "capitals" remain.** Across
   the repo none of these families is ever a key. In ccdv-f, "larger, more capable model" distractors went from 5 to 1,
   and the one left is the untouchable `D7.S1.official-1`, so U-6 note 4 is fixed. The R edits replaced the others with
   on-page lures, such as a gate check (`D1.S3.q1` B) and a harmlessness screen (`D7.S1.q2` B; page: "Use a lightweight
   model … to pre-screen user input", which is still wrong for "impact of a successful injection"). Still present in
   ccdv-f:
   - "larger context window" in `D1.S3.q2` A, `D5.S1.q1` and `D6.S1.q1` A. The last was edited in R3 and kept the idea.
   - The "capitals" family in 4 distractors.
   - `D4.S1.q1` D "Route those inputs to a different Claude model" keeps a model-swap idea, though in a form the errors
     page refutes.

   A test-wise learner can eliminate these. Follow-up material.
5. **[nit]** GOAL text is stale for U-7:
   - SC-5 (`GOAL.md:154`) says "the 68 flagged items and the U-6 rebalance picks", without the U-7 picks.
   - Affected › Surfaces (`:73`) lists three packs.
   - Out of Scope (`:189`) still names agent-skills and ai-capabilities as "already checked" and out of scope, although U-7
     edited them.

   LOOP-VERIFY and the evidence do state the true scope (111 questions in 6 packs), and U-7 overrides. Worth one line
   each so the next reader isn't misled.
6. **[nit]** The frozen file `mf-0061-longest-key-share.acceptance.test.ts` now tests the key-rank rule. Its name is
   stale. Renaming it needs a re-freeze, so leave it; the header comment is accurate.

The four U-6 notes U-7 asked to fix are all fixed: 2 (ceil), 4 (bigger-model family), 6 (C-3 and Affected count; C-3
now points at LOOP-VERIFY's 111) and 7 (test asserts `checked`). U-6 note 3 (small packs) is resolved by the minimum
of 10.

### Tell scan (whole packs; select 1, non-official; my script `mf0061-review3/tells.mjs`)

Hedge = may/can/often/typically/usually/generally/ideally. Absolute = always/never/only/all/cannot/must (the second column
drops `all`).

| Pack | n | Rank longest/2nd/3rd/shortest (max) | Key the only option with a hedge | A distractor has an absolute, the key none | same, without `all` |
|---|---|---|---|---|---|
| agent-skills | 54 | 12/14/11/17 (31%) | 4 (7%) | 15 (28%) | 14 (26%) |
| ai-capabilities | 48 | 11/14/15/8 (31%) | 6 (13%) | 14 (29%) | 15 (31%) |
| ccdv-f | 45 | 10/11/14/10 (31%) | 2 (4%) | 17 (38%) | 14 (31%) |
| claude-code-in-action | 66 | 24/16/9/17 (36%) | 2 (3%) | 24 (36%) | 21 (32%) |
| platform-foundations | 54 | 12/19/12/11 (35%) | 2 (4%) | 15 (28%) | 13 (24%) |
| prod-prompting | 54 | 14/16/14/10 (30%) | 4 (7%) | 21 (39%) | **22 (41%)** |
| subagents | 48 | 9/12/13/14 (29%) | 1 (2%) | 17 (35%) | 14 (29%) |

Before U-7 (`pre-u7`), the maximum rank shares were agent-skills 54%, ai-capabilities 50%, ccdv-f 44% and prod-prompting
67%. At HEAD they were ccdv-f 93% and prod-prompting 91%. Only one cell is ≥ 40%: prod-prompting's
absolute-in-distractor share, which is pre-existing (finding 2).

### R edits sampled (30 of 64; cited page read in `.cache/corpus` for each)

All 17 ccdv-f edits, all 8 edits that changed key text, and every NOTE/FIX from verify/R1–R5. ✓ = the key is unchanged in
id and still correct, its strictest qualifier is kept, the changed distractor is still wrong per the page, and no new tell.

| Item | Change (len → len, key) | Page says (quoted) | Result |
|---|---|---|---|
| ccdv-f.D1.S1.q2 | D +"multi-file … second call" (155, key 151) | building-effective-agents: orchestrator-workers when "you can't predict the subtasks needed" | ✓ |
| ccdv-f.D1.S3.q1 | B "larger model" → "gate check between retrieval and answering"; A padded | same page: frameworks "obscure the underlying prompts and responses, making them harder to debug" | ✓. B still doesn't restore visibility. A is padding (finding 1) |
| ccdv-f.D1.S3.q2 | **key** "writes … such as" → "keeps … like" (135) | effective-context-engineering: "structured note-taking"; "Waiting for larger context windows might seem like an obvious tactic" | ✓ |
| ccdv-f.D2.S3.q1 | A/D padded (134/138, key 132) | batch-processing (unchanged claims) | ✓. Padding (finding 1) |
| ccdv-f.D2.S4.q1 | D "anything" → "to its database" (143) | MDN Idempotent: idempotent ≠ no side effects | ✓ |
| ccdv-f.D2.S4.q2 | A "invalid" → "malformed" + rationale; C padded | MDN 429: "the user has sent too many requests in a given amount of time" | ✓ |
| ccdv-f.D4.S1.q1 | D "larger, more capable model" → "different Claude model" | errors: "529 - overloaded_error: The API is temporarily overloaded … high traffic across all users" | ✓. Model-swap idea remains (finding 4) |
| ccdv-f.D4.S1.q2 | A "more capable model" → "resend … until … validate"; B padded | handle-tool-calls: tool_result blocks first | ✓ |
| ccdv-f.D5.S3.q2 | **key** "the release's breaking changes … team's own evals" → "the breaking changes … use-case evals … team's real prompts" (156); D +"would" | choosing-a-model: "see Breaking changes … before switching"; "Create benchmark tests specific to your use case … Test with your actual prompts and data … Accuracy … quality … edge cases … cost tradeoffs" | ✓. Absolutes only in distractors (finding 2) |
| ccdv-f.D5.S4.q1 | B/D padded (137/144, key 135) | prompt-caching (unchanged claims) | ✓. Padding |
| ccdv-f.D6.S1.q1 | A/B/D each about +15 (129/129/124, key 114) | effective-context-engineering: "clearing tool calls and results … tool result clearing" | ✓. Padding; "larger context window" family (findings 1 and 4) |
| ccdv-f.D6.S3.q2 | **key** "like the tests or typecheck" → "like tests or a typecheck" (137); C/D padded | best-practices: "the turn doesn't end until the typecheck passes **or the block limit** is reached" | ✓. Must-keep "or the block limit is reached" intact (R3 FIX fold) |
| ccdv-f.D7.S1.q1 | B "Filter" → "Screen", +"body" (167); key unchanged (162) | mitigate-jailbreaks: "untrusted data and must never override the system prompt or the user's original request" | ✓. Key keeps "must never override" |
| ccdv-f.D7.S1.q2 | B "larger model" → "Pre-screen each user message with a lightweight harmlessness model"; C +"API" | same page: "Harmlessness screens: Use a lightweight model … to pre-screen user input"; "Apply the principle of least privilege so that a successful injection can do minimal damage" | ✓. B is an on-page lure, still wrong for impact; rationale apt |
| ccdv-f.D8.S2.q1 | D "need authenticated network access" → "serve many clients at once"; A/C padded | MCP architecture: "MCP supports two transport mechanisms: Stdio … Streamable HTTP"; "MCP recommends using OAuth" | ✓. Key keeps "ideally"; U-6 stem-echo note resolved (the new echo sits in a distractor, as a lure) |
| ccdv-f.D8.S3.q1 | C/D padded (126/129, key 122) | skills: "Add `disable-model-invocation: true` to prevent Claude from triggering it automatically" | ✓. C still false |
| ccdv-f.D8.S3.q2 | B +"public … then"; D +"to the request" (126/124, key 123) | tool-use overview: client vs server tools | ✓. Padding |
| ai-capabilities.D2.S4.q1 | **key** "explain why they matter" → "explain why" (62, shortest) | best-practices: "explaining to Claude why such behavior is important, can give Claude more information" | ✓. R2 NOTE agreed: object dropped, meaning kept |
| ai-capabilities.D2.S4.q6 | **key** "constrain the response to follow your JSON schema" → "constrain responses to your JSON schema" (70) | increase-consistency: Structured Outputs for guaranteed schema compliance | ✓ |
| ai-capabilities.D3.S2.q5 | A "…can no longer succeed" → "…so the agent knows to ignore injected text" (R2 FIX) | mitigate-jailbreaks: least privilege "so that a successful injection can do minimal damage" | ✓. Absolute removed |
| ai-capabilities.D2.S1.q5 | D −"too" | tracing-thoughts (unchanged claim) | ✓. Hedge/absolute pattern pre-existing (finding 2) |
| ai-capabilities.D3.S2.q6 | A "further" → "more" | reduce-hallucinations (unchanged) | ✓. Pattern pre-existing (finding 2) |
| agent-skills.D1.S1.q3 | B/C/D trims (R1 NOTE) | skills: "a skill's body loads only when it's used" | ✓. No negation or qualifier cut |
| agent-skills.D6.S2.q2 | A/C/D trims; "at all" dropped from C | best-practices: "Only add context Claude doesn't already have" | ✓. One distractor-only absolute fewer |
| agent-skills.D3.S2.q3 | A/B/D trims | best-practices: "Run `analyze_form.py` to extract fields … Only the script's output consumes tokens" | ✓ |
| prod-prompting.D1.S1.q2 | **key** "a prompt that mixes" → "prompts that mix … reducing" (103); C padded | best-practices: XML tags help Claude parse prompts with mixed content | ✓. Absolutes in A/B pre-existing |
| prod-prompting.D1.S1.q3 | **key** reworded (108), keeps "so never use them"; C +"or other formatting"; D −"instead" | best-practices: ellipses example, explained rule "More effective" | ✓. U-6 padding note on D fixed |
| prod-prompting.D2.S2.q4 | **key** −"The" (89); A +"tool … separate" | handle-tool-calls: tool_result blocks first | ✓ |
| prod-prompting.D1.S2.q6 | D replaced: "accepted but deprecated, as on Opus and Sonnet 4.6, so it still caps …" + new rationale (R4 NOTE fold) | best-practices: "budget_tokens … still functional on Opus 4.6 and Sonnet 4.6 but is deprecated. On Claude 4.7 and later models, setting budget_tokens returns a 400 error" | ✓. A strong on-page lure, wrong for the stem's 4.7+ model |
| prod-prompting.D3.S2.q1 | A "five minutes idle" → "going stale between separate requests"; D "after its knowledge cutoff" → "as the world keeps changing" (R5 FIX) | effective-context-engineering: "as the number of tokens … increases, the model's ability to accurately recall information … decreases" | ✓. Unsupported specifics removed |
| prod-prompting.D3.S3.q2 | A/B/D +23–31 chars (90/82/93, key 72) | rate-limits: "Limits are set at the organization level" (grounds D's "same organization") | ✓. D grounded; A/B are padding (finding 1) |

No key text lost a qualifier. No absolute was added to a distractor alone, and no hedge was added to a key alone.

### Delta verdict

**Approve.** There are 0 blocking findings. Finding 1 (filler) is the user's call. Findings 2 and 4 belong in the
reserved tell follow-up together with the earlier reviews' notes.

## Delta (orchestrator, 2026-11-07, tree 137959955f1d922c42f6c77cc0057cff7d619a48dbb9a7844a5a241431be7be1)
- Finding 1 (filler): 15 options in 9 questions reworded by a fresh drafter so added length carries a page-refuted claim;
  a fresh verifier over just these edits (`verify/F1.md`): 15 OK, 3 NOTE, 0 FIX; NOTE 1 applied. No key rank moved;
  must-keeps intact. Note 3: `rankName(rank, optionCount)`, tests for 2–6 options; 4-option messages unchanged, frozen
  SC-9 untouched. Nit 5 applied. check:packs, 31/31 targeted tests, full suite, gates, scope probe all green; frozen hashes
  match. Findings 2 and 4 reserved as MF-0073. Verdict: APPROVE.
