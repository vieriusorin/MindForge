---
ticket: MF-0025
outcome: pass
causes: known-trap-repeated, missing-context
actions: skill-edit
applied: 2026-11-05
lesson_keys: frozen-shape-collision-grep-in-plan, design-preflight-sc-preconditions
---
## Numbers
(No `pnpm ticket:retro` script exists; counts taken by hand from LOOP-VERIFY.md, GOAL.md and FROZEN.json.)
- Iterations: 1 (last_iteration 1). Fresh-context reviewer: not run (tier normal). No session token metrics available.
- RED at freeze: `Tests 3 failed | 1 passed (4)` (SC-1, SC-2, SC-5 red; SC-3 regression lock green by design), identical on a 2nd run.
- Gate: typecheck 0, lint 0, test `580 passed`, test:db `7 failed | 85 passed (92)`, all 7 in `mf-0013-storms`, identical on the stashed HEAD baseline, so no new failure.
- Re-freezes: 1 (MF-0007 SC-1, 2026-11-05, user-approved). SC amendments: 1 (SC-6, user-approved). Concerns raised after PLAN: 2 (C-3, C-4).
- Diff: 1 script hunk (+12 lines), 1 frozen test re-seed, 1 new acceptance file.

## Went right
- Intake read what references keys and items (the evidence table) before the checkpoint, and the user got options A/B/C for C-1 with the cascade cost stated. They chose A with no rework, and the script change was 2 SQL statements. — keep: already is (intake evidence-table pattern in `references/templates.md`).
- The flipped MF-0007 assertion was shown RED against the pre-change script (`git show HEAD:scripts/sync-question-keys.mjs`, `expected 7 to be +0`) before the re-freeze was recorded, and `FROZEN.json` history holds the reason and the new hash. — keep: already is (SKILL.md Stage 4 "re-freeze with a recorded reason").
- Baseline attribution was fast: `git stash -u` showed the same 7 reds at HEAD, so MF-0050 was reserved in one step instead of the failure being debated or fixed in this diff. — keep: already is (MF-0024 RETRO, "Baseline (before BUILD)").
- SC-4 was honestly typed as a code-read proof (C-2) rather than adding a test-only failure hook to production code. — keep: one-off, no change.

## Went wrong
- PLAN's frozen-collision grep ("no `*.acceptance.test.*` asserts orphan rows survive") was a wrong-shaped search. The collider was `mf-0007-review.db.acceptance.test.ts` SC-1, whose fixture inserts items under an unregistered slug and asserts `ITEMS.length` survive a sync (`// sync never touches a pack it doesn't own`). It surfaced only in TEST as C-3, and a separate user approval was needed. The agent first told the user the re-freeze was fixture-only, and corrected itself only on reading the assertion. cause: known-trap-repeated. The SKILL.md Stage 3 rule "Contract-widening tickets: grep the shape, not the table" exists and named MF-0007 SC-1 as a past victim (MF-0016), but its trigger is "adds a member to a closed set or a field to a shared shape". This ticket changed the *behaviour* of a shared writer (the sync script), so the rule never fired. The grep was run on the ticket's own words ("orphan"), not on the changed thing's name (`sync-question-keys`, `private.items`, `pack_slug`) or on what the old rule asserted. Same lesson key as MF-0016/MF-0024, so the written rule is still not where a behaviour change reads it.
- DESIGN preflight ran `typecheck && lint && test` but not `pnpm test:db`, although SC-6 said "`pnpm test:db` exits 0". The pre-existing `mf-0013-storms` red (22023 `not a playable question for this storm`) surfaced in TEST and forced an SC amendment (C-4) and a reserved ticket (MF-0050) mid-ticket. cause: known-trap-repeated. SKILL.md preflight (1) says "if an SC's proof is 'that command exits 0'" but lists only three commands, so the one SC that named a fourth command was not covered. (`design-preflight-sc-preconditions` has now been written, then missed, on 10+ tickets; the fix is making the rule's command list follow the SC text, not a fixed list.)
- Misreport to the user: "fixture-only" was stated from reading the fixture, not the test's assertion line. cause: missing-context. The collision hit list has no required field for the assertion that breaks, so the shortcut is available. Folded into action 1.

## Actions (at most two)
1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/SKILL.md`, Stage 3 paragraph that starts "**Contract-widening tickets: grep the shape, not the table.**". Replace the heading and first sentence with:
   "**Contract-widening or behaviour-changing tickets: grep the thing you change, not your own wording.** When the ticket adds a member to a closed set or a field to a shared shape (...), OR changes what a shared writer does to rows it did not write before (a sync/seed script, a SQL function, a trigger, a delete rule), list the frozen tests it will break before the plan is approved."
   Then append to the grep list: "For a behaviour change also grep for the changed file's name and path (`sync-question-keys`, `db:sync-keys`), the tables it writes (`private.items`, `question_keys`), and the column the new rule keys on (`pack_slug`). Each hit in 'Frozen files this will re-freeze' must quote the assertion line that breaks and the new expected value; a fixture-only hit is stated as 'fixture' only after the assertions of that file were read (MF-0025: MF-0007 SC-1 fixture inserted an unregistered slug and asserted it survived; found in TEST, told to the user as fixture-only first)." Would have saved: the TEST-stage stop for C-3, one separate approval round, and the incorrect "fixture-only" claim to the user.
2. skill-edit: same file, Stage 2 preflight item (1). Replace "Run `pnpm typecheck && pnpm lint && pnpm test` read-only. If any of them is red and an SC's proof is "that command exits 0"" with "Run `pnpm typecheck && pnpm lint && pnpm test` read-only, plus every other command a Success Criterion names as its proof (`pnpm test:db`, `pnpm build`, `pnpm check:packs`; local stack up first). If any of them is red and an SC's proof is "that command exits 0" or "no new failure"". Would have saved: the mid-TEST discovery of the `mf-0013-storms` red, the SC-6 amendment round (C-4) and the time spent proving it pre-existing under `git stash -u` after BUILD; the decision would have sat in the single DESIGN checkpoint.

## Not worth changing
- Token usage: no metrics available and the ticket was small (one 12-line script hunk, one test file). Real size, not waste; no change.
- A static gate for frozen collisions (list frozen tests whose source mentions a changed file) would be feasible, but the plan-check gate is already tracked separately (MF-0048) and belongs there. Do not add a second gate ticket; add this ticket's grep terms as a use case on MF-0048 when it is picked up.
- SC-3 frozen green as a regression lock: handled as the skill prescribes, no change.
- SC-4 as a code-read proof (C-2): correct given the validator duplicates the only CHECKs; no change.

## Applied

- 2026-11-05 action 1 (skill-edit, additive): `.claude/skills/gsd-goal-loop/SKILL.md` Stage 3 collision paragraph renamed and extended to behaviour-changing writers, plus the grep terms and the quote-the-assertion rule.
- 2026-11-05 action 2 (skill-edit, additive): same file, Stage 2 preflight (1) now runs every command an SC names as proof (`test:db`, `build`, `check:packs`).
- Held: none. Gate idea folded into reserved MF-0048 per the retro; no new ticket.
