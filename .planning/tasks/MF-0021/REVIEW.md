---
verdict: approve
reviewed_hash: 7c029c7b658a534e80045ac35f869b920f4a8ce5286ae6914ca90c7b43db883b
reviewed_at: 2026-11-05T09:31:14Z
---
## Iteration 1 (bound to `0745fa63…`, now void; kept for history)

I recomputed the hash with the recipe `(git diff HEAD -- . ':!.planning'; git ls-files --others
--exclude-standard -- src | xargs cat) | shasum -a 256` and it matches the hash above. Both frozen files
match their FROZEN.json hashes (MF-0011 `5b13580a…`, MF-0021 `026a27d3…`). These pass:
`vitest run src/engine/forest src/features/groups/components/group-heatmap` (7 files, 31 tests),
`pnpm typecheck`, and `biome check` on the touched folders. I did not run `pnpm build`, `test:db` or the
browser check for SC-5.

## What holds

- **A single snapshot does not pin N.** `healthyBandOf` (`src/engine/forest/group-heatmap.ts:54-58`)
  works on integers only. Each band is a half-open interval at least ⅓ wide, and every grid step
  1/(N·|S|) is at most ⅓ when N ≥ 3. So every band can be reached for every N and every skill count.
  - It also holds against what the viewer knows about their own trees. A healthy viewer plus "few"
    needs N > 3, and a viewer who has played already makes N ≥ 4. An unhealthy viewer plus "most"
    needs N ≥ 3.
  - The viewer's own state never rules out a value of N in the allowed range.
  - The status word is a threshold on the mean, and every band/status pair can occur for any N.
  - "No data yet" and "ready" at the minimum size are the accepted C-3 residual.
- **The DTO carries nothing finer than what is shown.** `HeatmapRegion` is
  `{domainCode, name, healthyBand, status}`. The percent helper and `retrievabilityPercent` are gone
  from the output. `retrievabilityPercent` (`:100`) is now a local only.
  - The only other consumer is `src/server/groups/get-group-heatmap.ts:23`, a pass-through into the
    RSC `GroupHeatmap`.
  - Running `grep` for `healthyPercent|retrievabilityPercent|regionFigures|heatBucket` under `src/`
    outside tests finds nothing.
- **The re-freeze is clean.** In the MF-0011 file diff, only the header comment, the SC-2 key list, the
  SC-4 expected keys and values, and the comments changed. No fixture line changed. I worked the
  values by hand:
  - A: 2 of 8 → 6 < 8 → few.
  - B and C: 1 of 4 → 3 < 4 → few.
  - Parity A: 2 of 6 → 6 is not < 6, and 6 < 12 → some.
  - Parity B and C: h = 0 → few, no-data.
  - The statuses are unchanged from the old percents (80 → fading, 95/90/100 → holding).
- **The MF-0021 acceptance values are right by hand.**
  - (3·0.9+0.7)/4 = 0.85 → holding.
  - (4·0.9+0.7)/5 = 0.86 → holding, and 4/5 → most.
  - 1/4 and 1/5 both read few and fading (0.75 and 0.74).
- **Rules are met.**
  - `BAND_LOOK` uses `as const satisfies BandLooks`.
  - Swatches are tokens only (`bg-chart-1/3/5`). There are no raw colours and no `dark:` overrides.
  - All four `utils.ts` exports are imported by `__tests__/utils.test.ts`.
  - The card has no `%`. The legend reads "85 in 100".
  - The view holds no hooks, and no props interface is declared in a `.tsx` file.

## Findings

- [blocking] `src/engine/forest/group-heatmap.ts:83-84` (`contributors = viewer.size > 0 ? [viewer,
  ...others] : others`, kept from MF-0011). **The viewer can pin N by comparing two snapshots and
  changing their own trees.** The bands then reveal how many members have played, in the 5–6 person
  groups CONTEXT.md calls typical. This defeats the ticket's end state ("no figure shown for a region
  reveals how many members have played"). I enumerated it with bands only, no percents.
  - **Attack B: the viewer's first play.** The group has G = 5 or 6 members and the viewer has not
    played, so N = the number of others who have, between 3 and G−1.
    - The viewer notes a single-skill region (D3/D4), answers one question correctly in some *other*
      region, and reloads.
    - Pairs in D3 go from n to n+1 and h stays the same.
    - Band `some → few` happens only when n = 3. In G = 5 that means exactly one named other has not
      played. In G = 6 it means two have not.
    - In G = 5, `some → some` happens only when n = 4, which means everyone has played.
  - **Attack A: the viewer toggles their own tree.** The group has G = 5 and the viewer has played, so
    N is 4 or 5.
    - The viewer reads D3, then answers their first D3 question correctly. Their pair goes from seed
      to a healthy sprout.
    - `some → some` happens only when N = 5. With N = 4, the three reachable `some` states
      (h = 2) always move to `most`.
  - **The gap in the tests:** SC-3 (`mf-0021-heatmap-bands.acceptance.test.ts`) only checks
    single-snapshot reachability, so it passes while the intent fails.
  - **The likely fix:** band over the *others* only and leave the viewer out of the pool. The viewer
    then cannot move any figure. Static reachability still holds, because the gate already guarantees
    N' ≥ 3. The card copy "Pooled from every member who has played" would need to change to match.
  - **Why the user must decide:** this reverses the MF-0011 user decision "the figures pool every
    contributor, the viewer included" (MF-0011 GOAL:60-61). It would also need another re-freeze,
    because MF-0011 SC-4 fixture C counts `v·C.1`. The user can make that call, or accept two-snapshot
    differencing as an explicit residual next to C-3. Either way, record it in GOAL.md before approval.
- [note] Passive differencing stays even with the fix above. A viewer who watches the card over days
  can see every region shift at once when another member plays for the first time. That is a coarse
  signal about others, not something the viewer controls, and is probably acceptable. It is worth
  naming in the residual.
- [nit] `src/features/groups/components/group-heatmap/utils.ts:27`: `BAND_LEGEND` restates the band
  order by hand (`[BAND_LOOK.few, BAND_LOOK.some, BAND_LOOK.most]`). The engine already owns that
  order in `HEALTHY_BANDS`. `HEALTHY_BANDS.map(bandLook)` would give the order a single owner, and
  would also give `HEALTHY_BANDS` (exported at `src/engine/forest/index.ts:12`) its only consumer
  outside the type derivation. As things stand it is an unused export.
- [note] I did not verify SC-5's browser check (port 3001, ≥ 3 other local players) or `pnpm build`.
  The receipt must carry them.

## Iteration 2 (delta review, bound to `7c029c7b…`)

I recomputed the hash with the same recipe and it is
`7c029c7b658a534e80045ac35f869b920f4a8ce5286ae6914ca90c7b43db883b`, matching the frontmatter. Frozen
hashes match the FROZEN.json files: MF-0011 `597efeb7…` and SC-7 `596f79ec…`. The SC-3 file is
unchanged at `026a27d3…`. `vitest run src/engine/forest src/features/groups` passes 53/53, and
`biome check` on the touched folders is clean. I did not rerun build, test:db or the browser check;
the coordinator reports build exit 0 and a browser check with no `%`.

### The it-1 blocking finding is resolved

- `summarizeGroupHeatmap` (`src/engine/forest/group-heatmap.ts:84-107`) now builds the band, the
  denominator and the recall mean from `others` only. `groupHeatmapFromAttempts` passes `new Map()` as
  the viewer (`:121-122`), so the viewer's attempts are not replayed at all.
- The viewer's own row can no longer move the card. That kills both it-1 two-load attacks: the
  viewer's first play and the viewer turning their own tree healthy.
- SC-7 (`mf-0021-viewer-excluded.acceptance.test.ts`) pins this two ways:
  - A first answer elsewhere gives the same card as before it, at the exact 1/3 edge, where it-1 would
    have flipped "some" to "few".
  - A viewer who is healthy everywhere gets the same card as a viewer who never played.
- **A single load still does not pin N.** N is now the number of others who have played, in
  [3, G−1]. Every band can be reached for every N ≥ 3 and every skill count, as before (SC-3). The
  viewer's own trees no longer constrain anything.

### The second re-freeze is clean

- Every line before the first `it(` block is byte-identical to `HEAD` (I diffed the fixture block). The
  changed lines are the header note, the SC-4 test 1 title, the comments, and the expected bands and
  statuses.
- I worked the values by hand, with fixtures m1, m2 and m3 as the others and v left out:
  - **A:** 3 others × 2 skills = 6 pairs. m1·A.1 and m3·A.1 are healthy, so h = 2. 3·2 = 6 is not < 6,
    and 6 < 12, so the band is **some**. The mean recall is (0.9+0.6+0.7+1)/4 = 0.80, which is
    **fading**. The viewer had no A memory, so the mean is unchanged.
  - **B:** 3 pairs, h = 1 (m3). 3 is not < 3, and 3 < 6, so the band is **some**. 0.95 → **holding**.
  - **C:** only v had C.1. Without the viewer h = 0, so the band is **few**. No other contributor has
    memory there, so the status is **no-data**.
  - The parity test is unchanged (`viewer: null`), so A some, B few/no-data, C few/no-data still hold.
- Both FROZEN.json files have history entries naming the user approval and the previous hash
  `5b13580a…`.
- My it-1 nit is fixed: `BAND_LEGEND = HEALTHY_BANDS.map(bandLook)` (`utils.ts:41`), so
  `HEALTHY_BANDS` now has a consumer and the band order has one owner. The card copy now says the
  viewer's own trees are left out, and CONTEXT.md matches the shipped behaviour.

### Findings (iteration 2)

- [note] **Collusion or a second account brings the two-load inference back. Residual, not
  blocking.**
  - Member X's card pools every member except X, so it includes member Y's row. Y controls that row.
    If Y helps X, or Y is X's own second account joined through the invite code, Y can turn one tree
    healthy or play for the first time while X reloads. That is the it-1 attack run through Y.
  - Example: G = 5, so N ∈ {3, 4}. Y turns a single-skill tree from unhealthy to healthy and X sees
    few → few. That can only happen when N = 4, so everyone has played.
  - No per-viewer exclusion can stop this without a larger gate or noise, which GOAL's Out of Scope
    already rules out.
  - The second account is visible in the member list.
  - Please record it in GOAL C-4's residual next to the passive "another member first plays" shift.
    As written, C-4 says the viewer controls only their own row, which is true for a lone viewer only.
- [note] `src/server/groups/get-group-heatmap.ts:18-27` still fetches the viewer's attempts, through
  `fetchGroupAttempts` → `viewer`, and then drops them. The gate needs `others` apart from the viewer,
  so the split is still required, but the viewer's attempts are now an unused read of the viewer's own
  data. This is not a privacy issue. A follow-up could skip that read.
- [note] `summarizeGroupHeatmap` still takes `viewer` and documents it as deliberately unused
  (`:70-74`). That keeps MF-0011's frozen call sites compiling, which is fine. A future caller cannot
  read anything into it, because the value has no effect (SC-7).

No blocking findings in iteration 2. Verdict: **approve**.
