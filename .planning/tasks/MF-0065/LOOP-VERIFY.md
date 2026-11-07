---
ticket_id: MF-0065
iteration: 0
verdict: PASS (fresh-context review APPROVE; should-fixes applied; re-freezes approved by the user)
tree_hash: e3eb7fc14de1fc4b3b0d4bbf41522b43ce6e98fb1423bfdede701fd25bca31db   # REVIEW recipe: sha256 of `git diff HEAD -- . ':!.planning'` + each sorted untracked non-.planning file ("== path" then content)
verified_at: 2026-11-07
---

# Loop Verify — MF-0065

## Baseline (before any change, 2026-11-07, base 07fd567)
typecheck 0 · lint 0 (863 files) · test 1329/1329 · test:db 205/205 after db:reset · check:packs 0 · main CI `success`.

## RED at freeze
| File | First failure (the SC's reason) |
|---|---|
| `src/engine/memory/__tests__/mf-0065-confidence-grading.acceptance.test.ts` | `Error: not implemented` (ratingFor, confidentMissAt); `expected 2.3065 to be close to 1.2931`; walk `expected 'strengthen' to be 'water'`; `expected '2026-11-26T09:00:00.000Z' to be '2026-11-22T09:00:00.000Z'` |
| `src/engine/memory/__tests__/mf-0065-next-item.acceptance.test.ts` | `Error: not implemented`; walk served `p.S1.q3` instead of `p.S1.q2` |
| `src/engine/misconceptions/__tests__/mf-0065-misconceptions.acceptance.test.ts` | `Error: not implemented` (24 cases); planLesson ignored `confusable` |
| `src/test/__tests__/mf-0065-check-misconceptions.acceptance.test.ts` | no `misconceptions:` summary; a tag on a correct option exited 0 |
| `src/server/db/__tests__/mf-0065-confidence.db.acceptance.test.ts` | `PGRST202` (5-arg function missing) ×6; SC-1 signature list = 4-arg pair. Run twice, identical |
| `src/features/__tests__/mf-0065-confidence-input.acceptance.test.ts` | `Pick an answer first.` for a valid `confidence` (strictObject) |
| `src/server/attempts/__tests__/mf-0065-grade-confidence.acceptance.test.ts` | `record_attempt` called without `p_confidence` |
| `src/features/__tests__/mf-0065-confidence-tap.acceptance.test.tsx` | `Unable to find role "group" … "How sure are you?"`; no "Mix-up to watch" |

Non-vacuity (run after BUILD): SC-7 engine — with the heatmap guard removed (`.map(withoutConfidence)` dropped),
`SC-7: the heatmap is identical…` fails: `expected { status: 'ready', …(1) } to deeply equal { status: 'ready', …(1) }`;
restored → passes. SC-7 DB is a regression lock (`group_attempts` unchanged), green after the fixture fix.

Own-file re-freezes (history in FROZEN.json): (1) SC-7 DB fixture lacked the NOT NULL `invite_code` (23502 — a
fixture red, not the SC's); (2) SC-10 `p_confidence: null` literal is unrepresentable in the generated Args type
(optional string) without a banned cast: no tap now sends no key (same DB call, default null; SC-1 DB proves null
is stored).

## Per SC
| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | db file: `SC-1: only the 5-arg signature exists…` ✓, `sure / unsure are stored…` ✓, `any other confidence is refused with 22023` ✓ |
| SC-2 | PASS | `SC-2: same id + same confidence…` ✓, `same id + another confidence, or null vs a value either way, is 23505` ✓ |
| SC-3 | PASS | `SC-3: a replay is bound to the content hash that graded it` ✓ |
| SC-4 | PASS | `SC-4: ratingFor maps…` ✓, `one first answer replays to the probed stabilities` ✓, `still a successful recall` ✓ |
| SC-5 | PASS | `CM1–CM6` ✓, `CM3 … walk waters it` ✓, `CM4 / CM5` ✓, `CM7` ×2 ✓, `CM8` ✓ |
| SC-6 | PASS | `NI1`–`NI5` ✓, walk re-asks `p.S1.q2` ✓; MF-0064 lesson acceptance files pass unedited |
| SC-7 | PASS | engine `heatmap is identical…` ✓ (non-vacuous, above); db `group_attempts rows carry no confidence` ✓ |
| SC-8 | PASS | parse: valid + 9 broken rules + unreadable ✓; script: 5 cases ✓; `pnpm check:packs` → `misconceptions: 1 file(s), 133 tag(s), 0 problem(s)` |
| SC-9 | PASS | `T1`–`T6`, mix-up, `K1`–`K3`, 3 planLesson confusable cases ✓ |
| SC-10 | PASS | 12 action cases ✓ (Duel, Walk, Seed Planting, Lesson); gradeAnswer 2 cases ✓ |
| SC-11 | PASS | 16 UI cases ✓ (4 modes × 4); browser: Duel `Sure=true` then `Sure=true(disabled)` after verdict; SQL read-back `ccdv-f.D5.S1.q1|f|sure|t` |
| SC-12 | PASS | 3 UI cases ✓; browser close screen "Mix-up to watch: A subagent passes back its raw output, file reads or full trace, not just a summary · picked 4 times in this lesson" |
| SC-13 | PASS | `docs/adr/0007-confidence-grades-recall.md`; CONTEXT.md Confidence, Confident miss, Misconception, Confusable skill; `gate:workspace` ok |
| SC-14 | PASS | ladder below; screenshots in `.planning/evidence/MF-0065/` |

## Ladder (current tree)
- `pnpm typecheck` exit 0
- `pnpm lint` exit 0 — `Checked 887 files in 155ms. No fixes applied.`
- `pnpm test` exit 0 — `Test Files  239 passed (239)` · `Tests  1417 passed (1417)`
- `pnpm db:reset` exit 0 → `pnpm test:db` exit 0 — `Test Files  40 passed (40)` · `Tests  212 passed (212)`
- `pnpm db:types` regenerated (attempts.confidence, `p_confidence?`)
- `pnpm check:packs` exit 0 — `misconceptions: 1 file(s), 133 tag(s), 0 problem(s)`
- `pnpm build` exit 0
- `pnpm gate:planning` exit 0 — `gate:planning: 70 ticket folders checked, ok`; MF-0060 checker against this tree: ok
- `pnpm gate:workspace` exit 0 — `gate:workspace: 4 allowBuilds entries, ok`
- Frozen hashes: every file in MF-0065/MF-0032/MF-0067/MF-0064 FROZEN.json matches the tree.


## Review fixes (after REVIEW.md, reviewed_hash cdce192a…; new tree e3eb7fc14de1fc4b3b0d4bbf41522b43ce6e98fb1423bfdede701fd25bca31db)
| Finding | Regression test | RED before the fix | After |
|---|---|---|---|
| should-fix 1: a confident miss could fall to the WALK_SIZE cut | `src/engine/memory/__tests__/plan-walk-confident-miss.test.ts` (12 wilting skills + 1 confident miss) | `AssertionError: expected 'S1' to be 'S13' // Object.is equality` | pass: confident misses lead the walk; `needWaterCount` 13, 10 items, S13 first |
| should-fix 2: pressed tap distinguishable only by colour | `src/components/confidence-tap/__tests__/confidence-tap.test.tsx` | `AssertionError: expected null not to be null` (no check icon on the pressed button) | pass: pressed = primary variant + lucide Check icon |
| note 3: lost-race tap comparison untested | `src/server/db/__tests__/mf-0065-lost-race.db.test.ts` | against a variant migration without `v_prev.confidence is distinct from p_confidence` on the lost-race path: `AssertionError: expected { data: true, code: null, …(1) } to deeply equal { data: null, code: '23505', …(1) }` | pass on the real migration (`isReleasedAtResponse: true`, one row with `sure`) |
Notes 5, 7: ADR 0007 revisit trigger now names "never tap"; CONTEXT.md Lesson entry names the review after a
confident miss. Nit 9: `submissionKey(…, confidence: Confidence | null)`. No frozen file touched; frozen hashes
(MF-0065, MF-0032, MF-0067, MF-0064) all match. Cross-ticket re-freezes approved by the user 2026-11-07.

## Ladder after the review fixes
- `pnpm typecheck` exit 0 · `pnpm lint` exit 0 — `Checked 890 files in 156ms. No fixes applied.`
- `pnpm test` exit 0 — `Test Files  241 passed (241)` · `Tests  1420 passed (1420)`
- db lock → `pnpm db:reset` exit 0 → `pnpm test:db` exit 0 — `Test Files  41 passed (41)` · `Tests  213 passed (213)`
- `pnpm check:packs` exit 0 — `misconceptions: 1 file(s), 133 tag(s), 0 problem(s)`
- `pnpm build` exit 0
- `pnpm gate:planning` — `gate:planning: 70 ticket folders checked, ok` (MF-0060 checker: ok) · `pnpm gate:workspace` ok

## Not verified
- Post-review delta (walk ordering, tap icon, one DB test, docs) not re-read by the reviewer.
- Walk confident-miss path in the browser (engine-proven by SC-5; not clicked).
- Screens were captured in the dark theme (headless Chrome follows a dark system setting); light mode not captured.
