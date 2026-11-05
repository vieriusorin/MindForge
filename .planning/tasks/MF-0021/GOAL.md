---
ticket_id: MF-0021
tier: high-risk                   # learner privacy (group heatmap: a figure over other people's data)
stage: handoff
branch: feat/MF-0021
builds_on: [MF-0011]
last_iteration: 2
goal_status: complete-pending-manual-commit
track: S
week: W3
depends_on: [MF-0011]
---

> Reserved 2026-11-04 from the MF-0011 review (residual of concern C-3, accepted by the user for v1).
> Claimed 2026-11-05 (this session). Baseline 2026-11-05: typecheck, lint, `pnpm test` (119 files,
> 522 tests) green; `main` CI: 5cd6bac success, 710eed4 in progress at DESIGN.

## Objective

Today the group heatmap shows no member count, but the count can be worked out from the figures.
The healthy share is `k ÷ (N × |S|)` in whole percent, so in a single-skill region (ccdv-f D3, D4) a
5-person group reading 25/50/75 % means N = 4: exactly one named member hasn't played. A probe on
2026-11-05 showed the leak is wider than single-skill regions: for N 3–12, 34 whole percents pin N
exactly (38 % or 63 % ⇒ 8 pairs), and a 2-skill region with N = 4 has 12.5 % steps. It leaks who has
played, never anyone's memory.

End state: no figure shown for a region reveals how many members have played. Every region shows the
healthy share as one of three bands, worked out exactly in the engine, and the average recall as a word
only. The heatmap DTO carries nothing finer than what is shown.

## Affected

- **Roles:** group member and group admin (same view). Non-members: unchanged (nothing).
- **Surfaces:** `src/engine/forest/group-heatmap.ts` (+ `index.ts` exports);
  `src/features/groups/components/group-heatmap/` (view, utils, types, tests); `CONTEXT.md` (Group
  heatmap term); MF-0011's frozen engine acceptance file (re-freeze, user-approved). No migration, no
  `src/server/**` change: `get-group-heatmap.ts` passes the engine result through.

## Constraints

- Terms: Group heatmap (CONTEXT.md). Aggregates only; gate unchanged (≥ 3 contributors other than the viewer).
- Figures come from `src/engine/**`; the band is decided on integers, never on a rounded percent.
- Colour is never the only signal (ui-design §5): every band and status carries a word, the legend names the bands.
- MF-0011 frozen files change only through the approved re-freeze.

## Constraints → how met

- Band on integers → `healthyBand` is `few` when `3·healthy < pairs`, `some` when `3·healthy < 2·pairs`,
  else `most` (`pairs = contributors × skills`). No float, no rounding at the edges (SC-2).
- DTO carries only what is shown → `HeatmapRegion` = `{ domainCode, name, healthyBand, status }`; no
  percent, no count (SC-1). The view is an RSC, so the payload holds rendered text only (MF-0011 review).
- Words → band label "Few / Some / Most healthy trees" + status badge; legend lists the 3 bands in words (SC-5).
- **What the viewer can deduce (privacy, gsd-goal-loop DESIGN):**
  - (a) The gate counts contributors OTHER than the viewer (unchanged, MF-0011 C-3).
  - (b) No contributor count is encoded in a figure's granularity. Every band is reachable for every
    N ≥ 3 and every skill count, so no pattern of bands across regions narrows N. The probe ran N 3–30
    and 1–6 skills; the argument is that each band is a half-open interval of width ⅓ ≥ 1/(N·|S|).
    The smallest region is a single skill. The smallest group that passes the gate is 4 (the viewer
    plus 3 others). The recall word is a threshold on the mean, not a count.
  - Worked example, the minimum and the leaking size: a 5-member group, the viewer has played, D3 has
    one skill, so N ∈ {4, 5}. Before, 75 % meant N = 4, so one named member hadn't played. Now 3 of 4
    and 4 of 5 healthy both read "Most", and 1 of 4 and 1 of 5 both read "Few", so N stays unknown (SC-3).
  - Two loads (it-2, C-4): the viewer controls only their own row, and it is left out (SC-7), so
    nothing the viewer does between two loads moves the card.
  - (c) A "ready" heatmap in a 4-member group still implies all 3 others have played, and universal
    statements stay deducible at the minimum size: the viewer's own D3 tree is unhealthy and D3 reads
    "Most" ⇒ all 3 others are healthy there, and "No data yet" ⇒ nobody has studied the region. These
    are out of scope: they are the C-3 "group fact" residual (user 2026-11-04, confirmed 2026-11-05).

## Edge-input table (healthy band; `pairs` = contributors × skills in region)

| Input state | Shown | Decided by |
|---|---|---|
| < 3 other contributors | "not enough data yet" card, no regions (unchanged) | MF-0011 C-3 (user) |
| region with no memory at all (healthy 0) | band `few` + status `no-data` ("No data yet") | definition: 0 < ⅓ (agent, from the band rule) |
| 1 of 4 healthy (just under ⅓) | `few` | band rule (user 2026-11-05) |
| exactly ⅓ (1 of 3, 2 of 6) | `some` | band rule: lower edge inclusive (user 2026-11-05) |
| 3 of 5 (just under ⅔) | `some` | band rule |
| exactly ⅔ (2 of 3, 4 of 6) | `most` | band rule: lower edge inclusive |
| all healthy | `most` | band rule |
| mean recall rounds to 85 % (0.846) | `holding` | MF-0011 N1 rule, unchanged (`wiltBelowRetrievability`) |
| mean recall rounds to 84 % | `fading` | same |
| no (member, skill) pair with memory | `no-data` | MF-0011, unchanged |

## Decided without a question

- Bands apply to **every** region, not only single-skill ones: multi-skill regions leak too (probe above).
- The status word keeps MF-0011's rule (rounded mean ≥ 85 → Holding); with no number shown, the rule
  is now internal, and keeping it avoids changing a decided threshold.
- The swatch ramp uses chart-1 / chart-3 / chart-5 for few / some / most (one violet hue, ui-design §2).
- `CONTEXT.md` Group heatmap entry is corrected: "≥ 3 members other than the viewer", bands, recall word.
- No proof command wipes shared local state: no migration, no `db:reset`. Browser check uses existing local users.

## Success Criteria

- [x] SC-1: A ready heatmap's regions carry exactly `domainCode`, `healthyBand`, `name`, `status`: no
  percent, no recall number, no count. Proof: MF-0021 engine acceptance test (key set).
- [x] SC-2: `healthyBand` follows the edge-input table on integers: 1/4 → few, 1/3 → some, 2/6 → some,
  3/5 → some, 2/3 → most, 4/6 → most, 0 → few, all → most. Proof: MF-0021 engine acceptance test.
- [x] SC-3: The count is not deducible from the bands. For N = 3…12 contributors in a 1-skill and in a
  2-skill region, the set of bands reachable over every healthy count is {few, some, most} for every N.
  The worked example also holds: 3 of 4 and 4 of 5 healthy in a single-skill region give equal region
  output, as do 1 of 4 and 1 of 5. Proof: MF-0021 engine acceptance test.
- [x] SC-4: The status word is unchanged: a mean of 0.846 → holding, 0.84 → fading, no memory →
  no-data. Proof: MF-0021 engine acceptance test.
- [x] SC-5: The group page heatmap shows, per region, the name, a band word ("Few / Some / Most healthy
  trees"), a status badge and a swatch, plus a legend of the 3 bands in words. No percent sign
  anywhere in the card. Proof: utils unit tests + browser check on port 3001 with ≥ 3 other local players.
- [x] SC-7 (added it-2, user 2026-11-05): the viewer's own memory never changes the card. The figures
  pool the members OTHER than the viewer. With a fixed set of others, any viewer memory (none, a first
  answer elsewhere, healthy everywhere) gives the same heatmap. Proof: `mf-0021-viewer-excluded.acceptance.test.ts`.
- [x] SC-6: MF-0011's engine acceptance file is re-frozen with the new keys and values (same fixtures),
  with a history entry. `CONTEXT.md` is updated. typecheck, lint, test, test:db (unchanged files) and
  build all pass. Proof: receipt.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | "No count from figures" vs "words and a number per region" (MF-0011 constraint) | user | resolved 2026-11-05: bands + recall word, no number |
| C-2 | Coarsening changes MF-0011's frozen SC-2 keys / SC-4 values | user | resolved 2026-11-05: re-freeze approved |
| C-3 | Universal facts at minimum group size (all/none healthy, no data) | user | resolved 2026-11-05: out of scope, C-3 residual |
| C-4 | Review it-1 (blocking): the figures pooled the viewer, so two loads around the viewer's own answer pinned N (1 of 3 "some" → 1 of 4 "few" only when exactly 3 others played). Reverses MF-0011's "viewer pooled in". | user | resolved 2026-11-05: others only (SC-7), second re-freeze of the MF-0011 engine file approved. Residual: the card shifts when another member first plays, which the viewer does not control (accepted with C-3). Re-review note: collusion or a second account (Y changes their own tree while X reloads) brings the two-load inference back. It needs a larger gate or noise; **flagged for the user at hand-off, not yet accepted**. |

## Out of Scope

- Universal "group facts" at the minimum size (C-3); a larger gate or noise. Individual sharing, leaderboards.
- The heatmap error boundary (MF-0011 review note 2), the SQL `rejected` DB test (MF-0011 N3).

## Decided by the user

- 2026-11-05: healthy share → 3 bands (under ⅓ / ⅓ to under ⅔ / ⅔ and up), every region.
- 2026-11-05: average recall → word only (Holding / Fading / No data yet).
- 2026-11-05: universal residuals out of scope (C-3 residual).
- 2026-11-05: re-freeze MF-0011 `mf-0011-group-heatmap.acceptance.test.ts` with new keys and values.
- 2026-11-05 (it-2, C-4): figures from the other members only; second re-freeze of the same file (SC-4 test 1).

## Open questions

- none.

## Iteration Log

<!-- append-only -->
- 2026-11-05 it-1: claimed; DESIGN decided with the user (4 answers); preflight green. Built; receipts green except the pre-existing storm DB reds.
- 2026-11-05 it-2: review it-1 changes-requested (C-4, two-load inference) → user: others only. Plan was wrong → SC-7 added and frozen red, MF-0011 file re-frozen, engine leaves the viewer out; nit (legend order from HEALTHY_BANDS) fixed.
- 2026-11-05 it-2 close: re-review approve on 7c029c7b…; receipt DONE (storm DB reds pre-existing). Hand-off.
