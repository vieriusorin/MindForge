---
ticket_id: MF-0021
iteration: 2
code_hash: 7c029c7b658a534e80045ac35f869b920f4a8ce5286ae6914ca90c7b43db883b   # (git diff HEAD -- . ':!.planning'; untracked src) | shasum -a 256
verdict: DONE
---

# LOOP-VERIFY — MF-0021

`ticket:verify` / `ticket:freeze` are not in `package.json`; defaults were run by hand
(LF-normalised sha256 per frozen file, as `scripts/lib/ticket-*.mjs` do).

## RED at freeze (2026-11-05T09:13:15Z)

- `mf-0021-heatmap-bands.acceptance.test.ts`: 5 × red, all for the SC's own reason (no `healthyBand` yet).
  - SC-1: `expected [ Array(5) ] to deeply equal [ 'domainCode', 'healthyBand', …(2) ]`
  - SC-2: `expected undefined to be 'few'`
  - SC-3: `expected { n: 3, bands: [ undefined ] } to deeply equal { Object (n, bands) }`
  - SC-3 worked example: `expected { domainCode: 'S1', …(4) } to deeply equal { domainCode: 'S1', …(4) }`. The first assertion compares 75 % with 80 %, which is the leak itself.
  - SC-4: `expected { domainCode: 'S2', …(4) } to deeply equal { domainCode: 'S2', …(3) }`
- `mf-0011-group-heatmap.acceptance.test.ts` (re-frozen, user-approved): 3 red / 2 green. SC-2 key set
  and SC-4 × 2 expect `healthyBand`. The two not-enough-data cases are unchanged and green.
- Non-vacuity: a probe on 2026-11-05 showed the rejected 5-bucket scheme cannot reach every bucket
  when N = 3 and the region has 1 skill. SC-3's enumeration therefore fails for it, while the 3-band
  rule reaches all bands for N 3–30 with 1–6 skills.

## RED at freeze, iteration 2 (C-4)

- `mf-0021-viewer-excluded.acceptance.test.ts`: 2 × `expected { status: 'ready', regions: [ …(2) ] } to deeply equal { status: 'ready', regions: [ …(2) ] }`.
  With the viewer pooled in, the card changed between viewer = none and viewer = a seed elsewhere, which is the review's two-load case.
- `mf-0011-group-heatmap.acceptance.test.ts` (second re-freeze, user-approved): 1 red, SC-4 test 1 (others-only values).

## Receipts (tree 7c029c7b…, iteration 2; the iteration-1 receipts on 0745fa63… are superseded)

| Check | Result |
|---|---|
| frozen hashes | 5/5 MATCH (MF-0021 × 3, MF-0011 × 2) |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | `Checked 542 files … No fixes applied.` |
| `pnpm test` | `Test Files 121 passed (121) · Tests 528 passed (528)` (`logs/test.log`) |
| `pnpm test:db` | `Test Files 1 failed \| 17 passed (18) · Tests 7 failed \| 64 passed (71)`. All 7 are in `mf-0013-storms.db.acceptance.test.ts` (`not a playable question for this storm`). **Pre-existing:** the same 7 fail on the unchanged tree (`git stash -u`, run that file, pop). This ticket touches no DB or server file. (`logs/test-db.log`) |
| `pnpm build` | exit 0 (`logs/build.log`) |
| browser 3001 | see SC-5 |

## Per SC

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | the MF-0021 acceptance key-set test is green; `HeatmapRegion` = domainCode, name, healthyBand, status |
| SC-2 | PASS | edge-table test green (1/4 few, 1/3 some, 2/6 some, 3/5 some, 2/3 most, 4/6 most, 0 few, all most) |
| SC-3 | PASS | enumeration N 3–12 × {1, 2 skills} green; worked-example equality green |
| SC-4 | PASS | 0.846 holding, 0.84 fading, no memory → no-data, green |
| SC-5 | PASS | Ana Steady (demo, 6-member ccdv-f group): 8 regions, each with a band word, a Holding badge and a swatch, plus a 3-band legend in words. `hasPercent: false` over the card's innerText. Swatches use chart-1/3/5 only. Light and dark both on tokens. Iteration 2 re-check: the new copy "your own trees are left out" is shown, `hasPercent: false`, and the console is clean. Console has no errors or warnings. Screenshots `logs/heatmap-light.png` (dark theme) and `logs/heatmap-light-mode.jpeg` |
| SC-6 | PASS | typecheck, lint, test, build pass. test:db: the 7 storm reds are pre-existing and identical on the unchanged tree; none are in a file this ticket touches. MF-0011 file re-frozen twice with history; CONTEXT.md updated |
| SC-7 | PASS | the 2 viewer-excluded tests are green |

## Review

- it-1 changes-requested on 0745fa63… (C-4, two-load inference) → user: others only.
- it-2 **approve** on `7c029c7b658a534e80045ac35f869b920f4a8ce5286ae6914ca90c7b43db883b` (REVIEW.md, recomputed by the reviewer). Notes: (1) collusion or a second account brings the two-load inference back. It is flagged for the user and NOT accepted on their behalf. (2) The viewer's attempts are still fetched, then dropped: a read of the viewer's own data, not a privacy issue. (3) The `viewer` argument is documented as unused.
