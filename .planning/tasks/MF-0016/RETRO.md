---
ticket: MF-0016
outcome: pass
causes: wrong-plan, known-trap-repeated
actions: skill-edit, gate
applied: 2026-11-04
lesson_keys: frozen-shape-collision-grep-in-plan, ai-content-claims-outrun-source, design-preflight-sc-preconditions, shared-devtools-browser
---
## Numbers
`pnpm ticket:retro` is not in package.json (`scripts/lib/ticket-retro.mjs` exists but no script calls it), and there are no session token metrics, so no token verdict is possible. Facts come from the artifacts.
- Tier high-risk (migration), 10 SCs, 5 acceptance files frozen RED, `last_iteration: 0`, plan approved, K-1..K-5 settled at checkpoint.
- Re-freezes: 4, all after the plan was approved and all user-approved one at a time: MF-0003 SC-5 (DESIGN, K-3), MF-0006 SC-6 and MF-0016 SC-5 fixture (BUILD), MF-0007 SC-1 (TEST).
- Receipt DONE at `12b277e5`: typecheck 0, lint clean, `Tests 337 passed (337)`, build 0, `test:db 45 passed (45)` (at `fb763a26`, one UI-only delta not re-run).
- REVIEW: `changes-requested` on the first pass with 1 blocking finding (content, D7.S2 line 3), then `approve` after a delta re-read.
- SC-9 passed with a deviation: the cuckoo body was never seen inside `/review/ccdv-f` in a browser.

## Went right
- Freezing 5 acceptance files RED with "not implemented" stubs, and recording the first failure for each SC in LOOP-VERIFY, meant every red was for the SC's reason. The ticket reached DONE on iteration 0. — keep: already is, in `gsd-goal-loop` Stage 2b.
- Every re-freeze changed a frozen test only by adding the new kind or shape (`cuckoos: []`, a kind row, a count that includes cuckoos). The reviewer recomputed all 8 hashes and read each re-freeze for loosened assertions. — keep: already is (`FROZEN.json` `history`, reviewer's check 5).
- The reviewer opened the cited source and found a second false line in an AI-drafted cuckoo that no test could see, then re-read the fix delta line by line. — keep: already is (`review-fix-delta-reread`, MF-0034 retro).
- Settling K-4 (key lag) and K-5 (repeat answers) at plan approval, with MF-0032 reserved, kept two known gaps out of the review as user-accepted. — keep: already is (high-risk checkpoint).
- The browser fallback was a `next start -p 3002` prod build rather than restarting the shared :3001 dev server, and the evidence file says why. — keep: already is, in `.planning/evidence/MF-0016.md`. It is only a one-off workaround, so it is not an action.

## Went wrong
- Four frozen-contract collisions surfaced one at a time, in four different stages. Each one stopped the ticket for a user re-freeze approval: MF-0003 SC-5 at DESIGN, MF-0006 SC-6 and the ticket's own SC-5 fixture at BUILD, MF-0007 SC-1 at TEST. All four enumerate item kinds or build the loader's output shape. LOOP-PLAN's "shared-contract consumers" step ran `grep -rln question_keys src scripts` (LOOP-PLAN.md line 166). That finds users of the table the ticket changes, and misses users of the thing it actually widens: the item-kind list (`item_type`, `ITEM_TYPES`), the `PackContent` shape and the registry rows. The plan did find MF-0003 SC-5 (K-3) and listed `PackContent` literals in frozen MF-0010/0014 tests, but only from the `question_keys` angle. Cause: wrong-plan. The PLAN stage in the skill says "read the frozen acceptance tests of `builds_on` tickets" only in a retro, not in SKILL.md Stage 3a (MF-0014 declined to write it, see its retro line 18).
- Blocking review finding: `packs/ccdv-f/cuckoos/D7.S2.yaml` line 3 said "so keys never enter the context", and the cited permissions page says deny rules do not cover arbitrary subprocesses. That is a second false line next to the keyed flaw. It broke the "exactly one planted flaw" premise and would have recorded a wrong attempt for a learner who knew the source. The softer D7.S1 note (flaw spread over lines 3-5) is the same shape. No test sees it, because the oracle is the author's own key. Cause: known-trap-repeated. It is the `ai-content-claims-outrun-source` lesson from MF-0031 (19 of 72 AI-drafted items had an absolute quantifier or an uncited identifier). That lesson proposed `scripts/check-pack-grounding.mjs`, which is not in `scripts/` or `package.json` yet, so nothing covered a new content kind. For cuckoos the cost is higher: every non-flaw line is meant to be true.
- SC-9 was proved without the browser because the review queue is one item at a time, so a cuckoo could only be reached after approving or flagging dozens of real items. The SC said "Proof: browser" and never named a way to reach the item. Cause: wrong-plan, an instance of `design-preflight-sc-preconditions` (see Not worth changing).

## Actions (at most two)
1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/SKILL.md`, Stage 3a PLAN, insert as a new paragraph after the "Write `LOOP-PLAN.md` ..." paragraph (ends "...from the plan alone.") and before "High-risk: present the plan and wait for approval."
   Text to add:
   "**Contract-widening tickets: grep the shape, not the table.** When the ticket adds a member to a closed set or a field to a shared shape (an item kind, `ITEM_TYPES`, a `CHECK` list, `PackContent`, a loader's return type), list the frozen tests it will break before the plan is approved. Run, over every `**/*.acceptance.test.*` and every path in the `builds_on` tickets' `FROZEN.json`: `grep -ln` for the set's name, its sibling members as literals (e.g. `'question'` next to `'card'`), the shape's type name, and any literal of the loader's output. Put each hit in LOOP-PLAN under 'Frozen files this will re-freeze', each with the new expected value and the reason, and take all of them to the plan-approval checkpoint as one batch. A collision found later is a re-freeze that stops BUILD or TEST for a separate approval (MF-0016: MF-0003 SC-5, MF-0006 SC-6, MF-0007 SC-1 and the ticket's own SC-5 fixture, one per stage)."
   Would have saved: three of the four mid-ticket re-freeze stops (the other, the SC-5 fixture date, is a fixture defect that a freeze-time look at R and the top 5 would have caught), each a context switch to the user, and the re-runs they forced.
2. gate: extend the already-proposed `scripts/check-pack-grounding.mjs` (MF-0031 retro, Action 1; build it as the same ticket if it does not exist yet), wired as `pnpm check:packs`, with a cuckoo rule: for every `packs/*/cuckoos/*.yaml` item, scan every entry of `lines` except `lines[flawLine - 1]`. A line that contains an absolute quantifier (`never`, `always`, `only`, `all`, `every`, `no ... can`, `guarantee`, `cannot`) fails unless the same word occurs in the cached text of one of the item's `sources` (`.cache/corpus/<sha256(url)>.json`) or the item carries a `# grounded: <word>` comment. Also fail when a non-flaw line's backticked token or identifier is absent from the cited text. Skip with a message when `.cache/corpus/` is absent. The real file it would have caught: `packs/ccdv-f/cuckoos/D7.S2.yaml` line 3 ("... so keys never enter the context", the first-pass blocking finding in REVIEW.md). Add `pnpm check:packs` to the "Before hand-off" line in `/Users/sorinvieriu/Projects/mind-forge/.claude/rules/testing.md` for tickets that touch `packs/**`.
   Would have saved: the one blocking review finding, the re-review of the fix delta, and the risk that a wrong line is shipped to learners as an unreviewed item. It also saves a human's time when the next AI-drafted content kind arrives.

## Not worth changing
- SC-9's browser proof (no way to reach one item in a one-at-a-time queue): same lesson as `design-preflight-sc-preconditions`, already in Stage 2 preflight. Add no new text. The SC text should have named the deep link or the seeded fixture it needs.
- The stale `"use cache"` read on the shared :3001 dev server, and the :3002 prod-build fallback: a one-off; the `shared-devtools-browser` memory already covers the shared server, and the fallback was recorded in the evidence file. If it happens a third time, write the fallback recipe in `feedback-browser-verification.md`.
- The `not-gradable` retry note (a transient RPC failure leaves "Skip" as the only option): UX only, nothing wrongly recorded, listed in the hand-off. It belongs to a follow-up, not to the process.
- Last delta (`fb763a26` to `12b277e5`) not re-run under `test:db`: it was a UI label move; the receipt states it. Not a pattern.
- A migration-in-place or `db:reset` lesson: none arose; the preflight kept the proof off shared state.

## Applied

- Action 1 (skill-edit, additive) **applied**: `.claude/skills/gsd-goal-loop/SKILL.md` Stage 3a, paragraph "Contract-widening tickets: grep the shape, not the table." inserted verbatim before "High-risk: present the plan…".
- Action 2 (gate) **reserved, not built**: `.planning/tasks/MF-0036/GOAL.md` (cuckoo rule for `pnpm check:packs`, builds on MF-0033, which already reserves `scripts/check-pack-grounding.mjs`). MF-0033 itself not edited (another session's reservation). The `testing.md` line is part of MF-0036 (guarded rule file).
- Memory: none proposed; none changed.
