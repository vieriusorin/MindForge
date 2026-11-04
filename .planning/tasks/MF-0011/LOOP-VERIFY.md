# MF-0011 LOOP-VERIFY — iteration 2

No `ticket:verify` / `ticket:freeze` / `ticket:eval` scripts in package.json: defaults run by hand
(gsd-goal-loop bindings). Receipt hash = sha256 of sorted `path\0sha256(file)` lines over every changed
non-`.planning/` file (tracked + untracked).

## Baseline (before any change, 2026-11-04 11:27)

typecheck 0 · lint 0 (332 files) · `pnpm test` 52 files / 195 tests passed · `pnpm test:db` 8 files / 27 tests passed.

## RED at freeze (2026-11-04T09:33:27Z)

```
mf-0011-group-heatmap.acceptance.test.ts
  × SC-2 ×2, SC-4 ×3 — Error: not implemented
mf-0011-group-heatmap.db.acceptance.test.ts (identical on 2nd run)
  × SC-1  AssertionError: expected false to be true          (to_regprocedure null: function absent)
  × SC-1  AssertionError: expected 'PGRST202' to be '42501'
  × SC-2  Error: not implemented                              (fetchGroupAttempts stub)
  × SC-3  PostgresError: function "public.group_attempts(uuid,uuid)" does not exist
```
Each red is the SC's own (missing function / stub), not a typo or fixture error. Typecheck green at freeze.

## RED at re-freeze (iteration 2, C-3, user approved)

```
mf-0011-group-heatmap.acceptance.test.ts
  × SC-2 ×2, SC-4 ×3 — Error: not implemented   ({viewer, others} API stubs)
mf-0011-group-heatmap.db.acceptance.test.ts (identical on 2nd run)
  × SC-2  Error: not implemented                 (fetchGroupAttempts stub)
  ✓ SC-1 ×2, SC-3 — iteration-1 migration already applied; file red as a whole
```
First re-freeze attempt also failed SC-3 (`expected [ …(3) ] to deeply equal [ …(2) ]`). That was a fixture
defect from the new other-pack attempt; the own-rows check was scoped to the pack before the freeze.

## Review fix N1 (bug: status word vs shown number), red before fix

```
× decides the word on the shown figure: a mean of 0.846 shows 85 % and reads 'holding' (review N1)
-   "status": "holding",
+   "status": "fading",
```
(old rule probed in place, then the fix restored: 6/6 green)

## Per SC (iteration 2)

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | DB acceptance SC-1 ×2 green |
| SC-2 | PASS | engine acceptance SC-2 ×2: 2 others (viewer playing) → `{status:"not-enough-data"}`; ready keys exactly `regions, status`; DB SC-2: `{viewer, others}`, viewer 1 attempt, others `[1,2]`, non-member and other-pack attempts absent, spoiled for M3 only |
| SC-3 | PASS | DB acceptance SC-3 (privileges; member refused; own rows only) |
| SC-4 | PASS | engine acceptance SC-4 ×3 (A 25/80 fading, B 25/95 holding, C 25/90 holding with the viewer pooled; filters; parity) |
| SC-5 | PASS | browser, local, 4 members: 3 played incl. viewer → "Not enough data yet. The heatmap appears once at least 3 other members have answered questions." (no count); 4 played → 8 regions with word + "NN% healthy trees · NN% average recall", legend, no count; AvatarGroup B1–B4; light + dark (it-1); console clean |
| SC-6 | PASS | advisors "No issues found"; grants gate green, unedited; component split; receipt 2 below; fresh-context review PASS-WITH-NITS on the same tree hash |

## Receipts

| # | When | Tree hash | typecheck | lint | test | test:db | build | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | 2026-11-04 ~11:55 | bc4a71d3…49c5 | 0 | 0 (346) | 0 (56 / 212) | 0 (9 / 31) | 0 | PASS: stale (iteration 1, superseded) |
| 2 | 2026-11-04 ~12:40 | 3a9b867f…65db | 0 | 0 (346) | 0 (56 / 213) | 0 (9 / 31) | 0 | **PASS: DONE for the current tree** (frozen hashes match; review bound to this hash) |

Post-retro check (2026-11-04): the full changed-file hash is now `2939295a…0ffd` because of the retro's skill edit
(`.claude/skills/gsd-goal-loop/SKILL.md`, markdown only). Without that file the hash is still `3a9b867f…65db`, so
receipt 2 covers every code file unchanged.
