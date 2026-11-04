# MF-0013 — LOOP-VERIFY

## Baseline (2026-11-04, `feat/MF-0013` at `bd4e1dc`, before any change)

- `pnpm typecheck` ✓ · `pnpm lint` 365 files clean · `pnpm test` 59 files / 233 tests ✓
- Local DB: migrations up to `20261103160000` (main's `20261104100000_mf0011_group_heatmap.sql` not
  applied yet; C-7 applies it with this ticket's migration). Keys re-synced: ccdv-f 53 keys, 56 items.

## RED at freeze (2026-11-04)

Typecheck ✓ and lint ✓ (371 files) with the stubs and tests in place. Each red is the SC's own.

`src/engine/storm/__tests__/mf-0013-storm.acceptance.test.ts` (frozen `be8c181d…`)
```
× SC-1: a Full Storm is 53 questions split by the blueprint, same seed → same storm   Error: not implemented
× SC-2: a short domain is filled from unreviewed (marked); …                          Error: not implemented
× SC-2: a Boss Storm is 12 questions of one domain, 1631 s, …                         Error: not implemented
× SC-2: a Boss Storm with fewer playable questions takes all of them, …               Error: not implemented
× SC-2: questions from an earlier storm appear only when the pool is otherwise short   Error: not implemented
× SC-5: per-domain %, survived ≥ 72, per-skill proven, StormDomainScore[]             Error: not implemented
```

`src/engine/forest/__tests__/mf-0001-stage.acceptance.test.ts` (re-frozen `fa0018f8…`)
```
× SC-6: storm-proven grows a Tree; …   AssertionError: expected 'sapling' to be 'tree'
✓ SC-5a, ✓ SC-5b (MF-0001 cases kept)
```

`src/server/db/__tests__/mf-0013-storms.db.acceptance.test.ts` (frozen `d774d647…`), identical on a 2nd run
```
× SC-3: the storm RPCs exist; …   AssertionError: public.start_storm(text,text,text,jsonb): expected false to be true
× SC-3 / SC-4 / SC-5 (7 more)     AssertionError: expected '' not to be ''   (STORM_ID guard: no storm started)
  control start (start checks)    AssertionError: expected { code: 'PGRST202', … } to be null
```

`src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts` (re-frozen `b4e794c2…`)
```
× SC-3: relation privileges … equal the allow-list   AssertionError: expected [ …(4) ] to deeply equal [ …(6) ]
```

`src/engine/forest/__tests__/mf-0011-group-heatmap.acceptance.test.ts` (re-frozen `f2d746e9…`): fixture
rename only, still ✓.

## Hook fix (approved 2026-11-04, separate hunk)

`src/test/__tests__/gate-io-to-rel.test.ts` before the fix:
```
× maps an absolute path inside the repo to a repo-relative POSIX path (any platform)
  Expected: "src/engine/storm/types.ts"
  Received: "C:/Users/Vlad-StefanParvana/Desktop/ccdv-f/MindForge/src/engine/storm/types.ts"
× returns null outside the repo
```
After `isAbsolute`: 3/3 ✓. Hook smoke run with Windows paths: ui-builder `supabase\x.sql` deny,
ui-builder `src\features\x.ts` allow, schema-builder `supabase\migrations\x.sql` allow,
service-builder `.claude\hooks\x.mjs` deny.

## Fresh-context review 1 (REVIEW.md, hash `4c3243a3…`): changes requested

Blocking B1 (client clock ends the storm) and B2 (answer echoes the stored hash, not the read one);
notes N1 cast avoidable, N2 multi-select untick not sent, N3 report 500 on a removed question,
N4 hand-built Full Storm of 2 reaches Ancient (residual, asked at hand-off), N5 voided wording.

Fixes, each with its regression test shown RED first:
- N1 + N2 (DB): `start_storm` trailing defaults; empty `p_chosen` clears. `mf-0013-storm-finalize.db.test.ts`
  before the SQL change: `(g)` `expect(cleared.error).toBeNull()` got 22023; `(h)` `expected 'PGRST202' to be
  '22023'` → after: 8/8, full `pnpm test:db` 47/47, storm files 16/16 on a 2nd run. `to_regprocedure(…(text,text,text,jsonb))` still resolves.
- B2 (server): `to-storm-session-question.test.ts` "names the deployed version's hash…" before the fix:
  `Expected: "deployed-now" Received: "stored-at-start"` → after: 3/3. Page passes `getItemHashes` per question.
- N1: `domainCode as string` removed from `start-storm.ts` (spread omits the arg for a Full Storm).
- N3 (page): a question missing from the deployed files is skipped in the running view and the review
  instead of throwing; the report still lists it as voided.

## Fresh-context review 2: approve (hash `b0023f12…`)

No blocking finding. B1, B2, N1, N2, N3, N5 confirmed fixed; N4 accepted by the user (2026-11-04) and
recorded in GOAL.md. Five non-blocking notes carried into the evidence as follow-ups.

## Receipt (2026-11-04, final tree)

Code-diff hash `b0023f12468b9ff1868ab7aa9e7fb200fd168b79490c90f211381f3a16c70f01`
(`git diff HEAD -- . ':!.planning'` + 78 sorted untracked files; = REVIEW.md review 2).
Logs: `.planning/tasks/MF-0013/logs/`.

| Check | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0, 442 files |
| `pnpm test` | exit 0, 80 files / 337 tests |
| `pnpm test:db` | exit 0, 11 files / 47 tests (storm files also green on a 2nd run) |
| `pnpm build` | exit 0; `/play/[packSlug]/storm/full`, `/play/[packSlug]/storm/boss/[domain]`, `/storms/[id]` partial prerender |
| `supabase db advisors --local` | "No issues found" |
| Frozen files (MF-0001, MF-0005, MF-0011, MF-0013) | 8/8 match FROZEN.json |

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | `mf-0013-storm.acceptance.test.ts` "SC-1" ✓ (53; D1 8 … D8 6; per-skill literals; same seed) |
| SC-2 | PASS | same file, 4 × "SC-2" ✓ (unreviewed fill marked; flagged/rejected/spoiled excluded; Boss 12 / 1631 s; 4 → 544 s; seen last) |
| SC-3 | PASS | `mf-0013-storms.db.acceptance.test.ts` 5 × "SC-3" ✓ + `mf-0013-storm-finalize.db.test.ts` (a)–(h) ✓ |
| SC-4 | PASS | DB "SC-4" ✓; `to-storm-session-question.test.ts` ✓; browser + curl view-source while running: no `rationale`, `"correct":`, `correctOptionIds`, `author` |
| SC-5 | PASS | engine "SC-5" ✓ (80/50/75, survived, proven, voided, StormDomainScore) + DB "SC-5" ✓ (1 attempt, `storm_id` set, voided q3 none) |
| SC-6 | PASS | re-frozen `mf-0001-stage.acceptance.test.ts` "SC-6" ✓; `memory-by-skill.test.ts` ✓ |
| SC-7 | PASS | Browser (Chrome, port 3001): D3 Boss Storm 2 q / 272 s; screen 04:21 vs DB 261 s left; live tick; answer saved with `correct` null; Finish dialog; report (shorter-than-planned, D3 50 % Not yet, unreviewed labels); review with keys. curl run (T4): D2 Boss 12 q / 1631 s, RSC `endsAt` = DB `ends_at`; skip/return/change; Full Storm 46 q / 6250 s with shortfall D1 6/8, D2 13/17, D5 8/9 |
| SC-8 | PASS | receipt above; component-split rules held per review 1 + 2 |

Verdict: **DONE** for this tree.
