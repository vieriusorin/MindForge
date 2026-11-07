---
verdict: approve
verdict_detail: "0 blocking, 2 should-fix (a confident miss can be cut from a full Daily Walk; the pressed tap is barely distinguishable from the unpressed one), 6 notes, 2 nits. SQL is correct: 5-arg pair only, revoke-then-grant to authenticated, definer only in private, search_path '', 22023 bound, confidence compared with `is distinct from` on both replay and lost-race paths, no grade from confidence. Engine grading matches D-6 / DQ-4 / ADR 0007. Privacy holds (group_attempts has no confidence; heatmap strips it). All 4 re-freezes change only signature literals, titles or a fixture."
reviewed_hash: cdce192a4fc4f97d29e29a1511bdfed671e889056d1bc6a69f75f4202ae53ed2
reviewed_at: 2026-11-07T11:43:12Z
---

# MF-0065 diff review (fresh context)

Scope: worktree `mind-forge-MF-0065`, uncommitted diff vs HEAD 07fd567 plus untracked files, `.planning` excluded
from the hash. I read GOAL, LOOP-PLAN, LOOP-VERIFY, FROZEN.json, the evidence, ADR 0005 and 0007, CONTEXT.md, and
the MF-0062 and MF-0067 artifacts. Then I read the whole diff.

## Runs (this review)

| Command | Result |
|---|---|
| `pnpm test` | 239 files, 1417/1417 pass (includes every non-DB MF-0065, MF-0064, MF-0016 and MF-0009 acceptance file) |
| `pnpm typecheck` · `pnpm lint` | 0 · 0 (887 files) |
| `pnpm check:packs` | `misconceptions: 1 file(s), 133 tag(s), 0 problem(s)`, exit 0 |
| `pnpm gate:planning` | 70 ticket folders, ok. MF-0060 plan-owns: every changed path sits in a task's `owns` |
| db lock → `pnpm db:reset` → `vitest --project db` on mf-0065-confidence, mf-0032-attempt-hash, mf-0067-retry-safe | 3 files, 23/23 pass. Lock released |
| Frozen hashes (LF-normalised sha256) | all 8 MF-0065 files and both cross-ticket files match their FROZEN.json entries |

## Findings

1. **[should-fix]** `src/engine/memory/plan-walk.ts:72,84,89,110`: the walk can drop a confident miss. A confident
   miss is pushed to `water` with score `weight × (1 − R)`. CM3 says R ≈ 1.0 for the first day after a lapse, so the
   score is about 0 and the miss sorts last among water items. `.slice(0, WALK_SIZE)` (10) then cuts it whenever the
   learner has 10 or more wilting or attempted-Seed skills.
   Scenario: a ccdv-f learner has 12 skills that need water, then taps Sure on a wrong answer in skill X. The close
   screen says "Next review: <miss + 24 h>" and the Today count says "13 trees need water" (`needWaterCount` counts
   X), but X is never served, so ADR 0007's "the Daily Walk includes it" does not hold. SC-5 only tests a two-skill
   pack, so this passes.
   Fix: give confident misses a fixed top score, or put them first in `head`, and add a unit test with more than
   WALK_SIZE water skills.

2. **[should-fix]** `src/components/confidence-tap/confidence-tap.tsx:36`: pressed vs unpressed is
   `secondary` vs `outline`. The only visual difference is a lavender fill against a border. In dark mode
   (`.planning/evidence/MF-0065/sc-11-duel-sure-tapped-desktop.png`), "Sure" (pressed) and "Not sure" look almost
   the same. `aria-pressed` covers screen readers. For sighted users the state rests on a low-contrast fill change,
   which goes against ui-design §5 ("never rely on colour alone") and WCAG 1.4.11. Because the tap changes the
   grade, a learner who cannot see which one is pressed may grade wrongly.
   Fix: add a lucide `Check` icon to the pressed button, or use the `default` (primary) variant when pressed.

3. **[note]** `supabase/migrations/20261107100000_mf0065_attempt_confidence.sql:124-129`: the lost-race path's
   `v_prev.confidence is distinct from p_confidence` is correct by inspection but has no test. SC-2 only exercises
   the replay path (sequential calls). MF-0067 has the same gap for its own fields, so this is not a regression.

4. **[note]** Misconception tags are bound to no content hash (DQ-7, a deliberate choice) and are not part of the
   MF-0007 review flow. Their labels reach learners verbatim ("Mix-up to watch: <label>").
   - The guards are `check:packs` (structure: a tag on a correct option or a missing option fails) and a one-off
     agent review (evidence line 15-16).
   - A later rewrite of an option's meaning, like MF-0061's rewrites in other packs, keeps a stale tag silently, as
     long as the option is still a distractor.
   - If a structural break ever slips past CI, `loadPackMisconceptions` throws
     (`src/engine/misconceptions/load-misconceptions.ts:38`), and both lesson pages fail for that pack. That is
     fail-loud by design. It is worth knowing before the other packs are tagged.
   - I sampled 10 tags against `packs/subagents` (the questions are identical on origin/main; MF-0061 did not touch
     this pack). All 10 labels match the distractor's text and rationale: D2.S2.q6 C, D3.S1.q4 A, D1.S1.q6 C,
     D2.S1.q1 B, D2.S2.q4 B, D3.S1.q1 C, D1.S1.q4 B, D4.S2.q1 A, D3.S1.q5 C, D2.S2.q2 D. 48/48 questions are tagged.
   - Suggested follow-up: record each tagged item's content hash in the file and have `check:packs` flag a tag
     whose item hash changed.

5. **[note]** Incentives (DQ-4 + DQ-6). No tap grades the same as Sure (Good on correct, no 24 h item on wrong),
   while Not sure + correct grades Hard. An honest "Not sure" is therefore never better than not tapping, and a
   learner who never taps grows fastest. ADR 0007's revisit trigger watches for "taps Sure on nearly everything".
   The more likely failure is "never taps". This is a product decision (C-3 accepted), recorded here so the ADR's
   revisit criterion can include it.

6. **[note]** One owner per fact: the 24 h rule reaches the Walk (`planWalk`) and the close screen
   (`lessonOutcome` → `nextReviewAt`). Both read countable attempts through `confidentMissAt`, so they agree. The
   forest, the map's "Fading" and "Water first", and the heatmap stay pure FSRS, as DQ-5 decides. One consequence:
   Today's "N trees need water" can now exceed the forest's fading count. That was already true for attempted Seeds.
   Also, after a confident miss the map gives no cue; the Walk is the only route back within 24 h.

7. **[note]** `CONTEXT.md:36` (Lesson) still says the close screen's next review date is "the day the tree starts
   to fade". With a confident miss it is now at most miss + 24 h. The Confident miss entry states this, but the
   Lesson entry contradicts it on its own. Suggest appending "(or sooner after a confident miss)".

8. **[note]** Rebase: origin/main's MF-0061 changed `scripts/check-pack-grounding.mjs` (+ `scripts/lib/key-length.mjs`)
   in the same region where this diff inserts the misconceptions block. That is a textual conflict for the
   orchestrator, not a design dependency: `packs/subagents` is identical on main, and the new block is independent
   of the key-length rule. Re-run `pnpm check:packs` and the mf-0065-check-misconceptions acceptance file after the
   rebase.

9. **[nit]** `src/lib/attempt-id.ts:32`: `confidence: string | null` could be `Confidence | null`. Every caller
   passes a `Confidence`, and the narrower type documents the key's domain.

10. **[nit]** `src/components/confidence-tap/confidence-tap.tsx:22-28`: a `<fieldset aria-label>` with an
    `aria-hidden` span works (role group, name "How sure are you?"). A visually styled `<legend>` would give the
    same name without duplicating the text.

## Focus checklist

- **SQL (1):** 4-arg pair dropped, 5-arg private definer + public invoker, `search_path = ''`, revoke from
  public/anon/authenticated on private then grant authenticated, public revoked from public/anon then granted
  authenticated. No grant change on `public.attempts` (SC-1 asserts no INSERT/UPDATE/DELETE). The confidence check
  comes before replay (22023, nothing written), backed by the CHECK constraint. Replay and lost-race both compare
  confidence with `is distinct from`, so null vs value is refused both ways (SC-2 tests both directions on replay).
  The replay is bound to the stored hash (SC-3), and the client sees the first grade with the current file's key.
  Same hash ⇒ same key (F-8, MF-0067 note 6 kept). The tap never touches `v_correct`.
- **Grading (2):** `ratingFor`: correct+sure Good, correct+unsure Hard, wrong Again, no tap Good/Again. This is
  consistent with D-6, DQ-4 and the ADR 0007 table. Hard still counts as a successful recall. The 24 h rule is
  derived in the engine from the latest attempt (no stored due date, D-4). There is no `Date.now` / `new Date()` in
  the touched engine code; the clock comes in through `now` and `answeredAt`.
- **Privacy (3):** `group_attempts` builds its jsonb field by field with no confidence (SC-7 DB part). The
  `groupHeatmapFromAttempts` guard strips confidence and chosen before replay, and the SC-7 engine test proves it.
  Expeditions count `a.correct` in SQL. Attempts RLS is select-own. `fetchAttempts` is used only by `listMyAttempts`
  (the session user). No RPC returns another user's confidence. Viewer invariance is unaffected.
- **Misconceptions (4):** see note 4. The tally is pure; `lessonMixUp` filters the viewer's own attempts since the
  lesson start.
- **Next item (5):** `orderSkillItems` is pure and stable (bucket, then time, then file order; it does not mutate its
  input). The Walk uses it. The Duel and Cuckoo keep `leastRecentlySeen`, so MF-0016 SC-5 is untouched (passes).
  The MF-0064 lesson files pass unedited.
- **UI (6):** an optional tap in Duel, Walk, Seed checks and the lesson. Two shadcn `Button`s with `aria-pressed`
  inside a labelled group, `min-h-10`. It is locked while pending and after the verdict and reset on Next. Each mode
  follows the split rules (state in the hook, view props only, shared view in `src/components` with a second-feature
  consumer). `walk-session.test.tsx` is not a frozen file; its edit adds two focus assertions (Sure, Not sure)
  before the unchanged "Check answer" focus assertion, so it is stronger, not weaker. Pressed-state visibility:
  finding 2.

## Re-frozen files

| File | Previous → new sha256 (prefix) | What changed | Assertions weakened? |
|---|---|---|---|
| `src/server/db/__tests__/mf-0032-attempt-hash.db.acceptance.test.ts` | 0606f4df → 9954b4f4 | SC-7 title; the two signature literals `(text,text[],text,uuid)` → `(text,text[],text,uuid,text)`. `auth: true` / `anon: false` unchanged | No |
| `src/server/db/__tests__/mf-0067-retry-safe.db.acceptance.test.ts` | 338ded36 → 071de2cd | SC-7 title; the same two signature literals. Column, unique-key, grant and legacy assertions unchanged | No |
| `src/server/db/__tests__/mf-0065-confidence.db.acceptance.test.ts` (own) | 8aaee47c → 1c52545c | SC-7 group-insert fixture gains the NOT NULL `invite_code` (23502 was a fixture red). Not diffable (untracked); the current file's SC-7 asserts non-empty keys and no `confidence` key | No (fixture only, per FROZEN history) |
| `src/server/attempts/__tests__/mf-0065-grade-confidence.acceptance.test.ts` (own) | 758c55cc → 25cce7a3 | "no tap" expectation `p_confidence: null` → no `p_confidence` key. Same DB call (default null); SC-1 DB proves a no-tap row stores null | No. An exact-payload absence is at least as strict |

The cross-ticket re-freezes (MF-0032 SC-7, MF-0067 SC-7) still need the user's approval (marked PENDING in both
FROZEN.json histories), as the GOAL reports.

## Delta re-review (orchestrator, 2026-11-07, tree e3eb7fc14de1fc4b3b0d4bbf41522b43ce6e98fb1423bfdede701fd25bca31db)
- Should-fix 1: `plan-walk.ts` puts confident misses in their own list ahead of the water list before the WALK_SIZE cut;
  `needWaterCount` counts both. Regression with 12 wilting + 1 confident miss RED on the reviewed code
  (`expected 'S1' to be 'S13'`), green now. Engine only; no auth/delete/privileged path. Resolved.
- Should-fix 2: pressed tap = primary variant + `Check` icon; RTL test RED first. Resolved.
- Notes 3 (lost-race confidence DB test, RED against a variant migration), 5 (ADR revisit trigger), 7 (CONTEXT.md), nit 9
  applied. Cross-ticket re-freezes approved by the user 2026-11-07. Verdict: APPROVE.
