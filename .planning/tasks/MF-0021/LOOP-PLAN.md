---
ticket_id: MF-0021
iteration: 2
---

# LOOP-PLAN — MF-0021 heatmap bands

## Iteration 2 (review C-4)

- T4 (engine): `summarizeGroupHeatmap` uses `others` only for the gate and the figures. `viewer` stays in
  the input, because frozen callers pass it, and is documented as deliberately unused.
  `groupHeatmapFromAttempts` no longer replays the viewer. Closes SC-7 and the re-frozen MF-0011 SC-4.
- T5 (UI): the card copy says the viewer's own trees are left out; `BAND_LEGEND = HEALTHY_BANDS.map(bandLook)` (nit).
- T6 (docs): CONTEXT.md says the figures come from the other members.
- Rejected: keeping the viewer and accepting the two-load inference (user chose others only).

## Discovery

- `src/engine/forest/group-heatmap.ts` is the only producer of `HeatmapRegion`. Its consumers are
  `src/engine/forest/index.ts` (re-exports), `src/features/groups/components/group-heatmap/`
  (`group-heatmap.tsx`, `utils.ts`, `types.ts`, `__tests__/utils.test.ts`) and the inner test
  `src/engine/forest/__tests__/group-heatmap.test.ts`. `grep -rln healthyPercent src` lists nothing else.
- `src/server/groups/get-group-heatmap.ts` passes the engine result straight to the RSC view, so no
  server change is needed. The DB acceptance file of MF-0011 asserts no figure.
- Precedent: MF-0011 (same files); `STATUS_LOOK` lookup-table shape in `utils.ts`.
- Gates on these paths: none beyond typecheck, lint and test (no allowlist, no grants change).

## Frozen files this will re-freeze

- `src/engine/forest/__tests__/mf-0011-group-heatmap.acceptance.test.ts`: SC-2 key set →
  `domainCode, healthyBand, name, status`; SC-4 test 1 A/B/C → few (fading/holding/holding); SC-4
  parity A → some (2/6 = ⅓), B/C → few + no-data. Approved by the user 2026-11-05; done at freeze
  (hash `5b13580a…`, history entry in MF-0011 FROZEN.json).

## SC → steps

| SC | Steps | Proof |
|---|---|---|
| SC-1..SC-4 | T1 | `mf-0021-heatmap-bands.acceptance.test.ts`, re-frozen MF-0011 file |
| SC-5 | T2 | `group-heatmap/__tests__/utils.test.ts` + browser on 3001 |
| SC-6 | T3, TEST | receipt |

## Steps

1. **T1 engine.** In `group-heatmap.ts`: `HEALTHY_BANDS = ["few","some","most"] as const` plus the
   derived `HealthyBand` type; `healthyBandOf(healthy, pairs)` on integers (`3h < p` → few,
   `3h < 2p` → some, else most; `pairs` is ≥ 3 because the gate guarantees it); `HeatmapRegion` drops
   `healthyPercent` and `retrievabilityPercent` and gains `healthyBand`; `statusOf` keeps the rounded
   ≥ 85 rule on an internal mean. Remove the `percent` helper. Export `HealthyBand` and
   `HEALTHY_BANDS` from `index.ts`. Rewrite the inner tests: band edges, the viewer not counted,
   foreign skills, the 0.846 rule.
2. **T2 UI.** In `utils.ts`: replace `HEAT_BUCKETS`, `heatBucket` and `regionFigures` with a
   `BAND_LOOK` table (`as const satisfies Record<HealthyBand, {label, swatch}>`: few → "Few healthy
   trees" / `bg-chart-1`, some → "Some healthy trees" / `bg-chart-3`, most → "Most healthy trees" /
   `bg-chart-5`), plus `bandLook(band)` and `HEALTHY_BAND_LEGEND` (the ordered list the legend
   reads). Drop the local `HeatBucket` from `types.ts`. In the view: swatch from `bandLook`, the band
   label as the description, and a legend in words ("Few: under a third · Some: a third to two
   thirds · Most: two thirds or more"). Keep the Holding/Fading legend line without a number other
   than the 85 % threshold, which is a constant, not a figure. Update `utils.test.ts` (every export).
3. **T3 docs.** Fix the CONTEXT.md "Group heatmap" entry.

## Riskiest step

The band boundary (T1): computing it from a rounded percent would put 33/100 and 1/3 in the same
band, and computing it from a float risks `2/6 * 3 < 1` drift. Mitigation: integer comparison only;
SC-2 pins both exact edges, and SC-3 enumerates N 3–12 for 1- and 2-skill regions. This plan is not
a versioned-content write and not a re-runnable writer, so the DESIGN checks for those don't apply.

## Rejected options

- Coarsening only in the UI (engine keeps percents): the count would still sit in the DTO, and a
  rounded percent can't place the ⅓ edge exactly (user declined, 2026-11-05).
- 5 shade buckets: N = 3 cannot reach the 40–59 bucket in a single-skill region (probe 2026-11-05).
- Bands on single-skill regions only: multi-skill regions pin N too (2 skills × 4 contributors = 12.5 % steps).

```json tasks
[
  {"id":"T1","agent":"service-builder","owns":["src/engine/forest/group-heatmap.ts","src/engine/forest/index.ts","src/engine/forest/__tests__/group-heatmap.test.ts"],"depends_on":[],"closes":["SC-1","SC-2","SC-3","SC-4"],"done_when":"both frozen engine acceptance files green; inner tests green","context":"GOAL.md edge-input table"},
  {"id":"T2","agent":"ui-builder","owns":["src/features/groups/components/group-heatmap/**"],"depends_on":["T1"],"closes":["SC-5"],"done_when":"utils tests cover every export; browser shows bands + legend, no %","context":"ui-design §2, §5"},
  {"id":"T3","agent":"service-builder","owns":["CONTEXT.md"],"depends_on":["T1"],"closes":["SC-6"],"done_when":"term matches the shipped behaviour","context":"MF-0011 C-3"}
]
```
