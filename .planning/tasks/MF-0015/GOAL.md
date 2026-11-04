---
ticket_id: MF-0015
tier: normal                      # pure engine + dashboard UI; no schema, no authz, own data only
stage: handoff
branch: feat/MF-0015
builds_on: [MF-0003, MF-0006, MF-0007]
last_iteration: 0
goal_status: complete-pending-manual-commit
track: E + G                      # seat Owner (Sorin)
week: W3–W4
depends_on: [MF-0006]             # exam.date; storms arrive as an input type, empty until MF-0013
---

> Drafted 2026-11-03 from the planning grill (Q9). Claimed and designed 2026-11-04.

## Objective

Today the dashboard (`/today`) shows tree stages but doesn't answer the question a learner has five
weeks out: "Where will I be weak on exam day?"

End state: per domain, the **memory forecast** (skill-weighted retrievability projected to the exam
date) and the **last storm score**, combined into **readiness weather** (sunny / cloudy / rain / fog)
from the lower of the two, and an overall line against a 72% "pass mark (approx.)" reference. No
estimated scaled score is ever shown.

## Affected

- **Roles:** learner (own data only; nothing about other people is read or shown).
- **Surfaces:** new `src/engine/readiness/**`; new `src/features/dashboard/components/readiness-card/`;
  `src/app/(app)/today/page.tsx` (one engine call + one card).
- **Tables:** none (reads the attempts the page already loads).

## Constraints

- Terms: Memory forecast, Readiness weather (CONTEXT.md). Exam packs with an exam date only.
- Every figure from `src/engine/readiness/`; no arithmetic in components.
- Weather shows words + icon, never colour alone; ui-design §1 (shadcn only, lucide icons, tokens).
- Clock passed in (`now`); no `Date.now()` in the engine.

### Constraints → how met

- Figures from the engine → `readiness()` returns every percent already rounded; the card only renders.
- Words + icon → each weather value maps to a lucide icon AND its word in a `Badge`; the icon is `aria-hidden`.
- Exam packs only → `readiness()` returns `null` for a non-exam pack or an exam pack without `exam.date`; the page renders no card.
- No scaled score → no figure on the 100–1000 scale is computed or shown; the reference is the literal "72% pass mark (approx.)".
- Privacy → single learner's own attempts; no aggregate over other people, so the MF-0011 deduction check does not apply.

## Decided without a question

- Thresholds (CONTEXT.md): sunny ≥ 85%, cloudy 72–<85%, rain < 72%, fog = no data. Overall = blueprint-weighted mean of domains.
- `StormDomainScore = { domainCode, percent, finishedAt }` in `src/engine/readiness/types.ts`; the page passes `[]` until MF-0013 merges; whichever ticket merges second wires the real storm results.
- Forecast = FSRS retrievability at the exam date from each skill's current state, no future reviews assumed. Implemented by replaying the learner's **countable** attempts (MF-0007, same set the forest uses) with the clock set to the horizon — the existing `replayMemory`, so the forecast and the forest can never disagree on a skill's state.
- Horizon = the exam date at 00:00 UTC, or `now` if that is already past (after the exam the forecast is "today").
- "Last storm score" for a domain = the `percent` of the storm entry with the latest `finishedAt` for that domain.
- Domain readiness value = min(forecast, last storm %) when both exist; forecast alone when no storm ("no storm yet"); storm alone when no memory.
- Weather is decided on the **whole-number percent shown**, so the word never contradicts the number next to it (84.6 → shows 85 → sunny).
- `readiness({ pack, attempts, storms, now })` takes an object (code-conventions: > 2 args). It is pure and lives in `src/engine/readiness/`.
- Placement: a "Readiness" card on `/today` in the existing grid; icons Sun / CloudSun / CloudRain / CloudFog from lucide.

## Decided by the user (2026-11-04)

- C-1: a skill never attempted counts as 0% in its domain's forecast (forecast is weighted over every skill of the domain).
- C-2: no readiness for a non-exam pack or an exam pack without `exam.date` (`readiness()` returns `null`, no card). Supersedes the draft's "other packs show the forecast alone".
- C-3: a fog domain counts as 0% in the overall %; overall is fog only when every domain is fog.
- SCs SC-1…SC-5 approved for freeze as written.

## Success Criteria

- [x] SC-1: `readiness({ pack, attempts, storms, now })` with fixtures returns, per domain, the memory forecast %, the last storm % (or none), the weather and the overall % + weather; values hand-computed in the test from FSRS-6's published forgetting curve. Proof: `src/engine/readiness/__tests__/mf-0015-readiness.acceptance.test.ts`, fixed clock.
- [x] SC-2: A domain with no storm and no memory is "fog"; with memory but no storm it uses the forecast and is marked "no storm yet"; with a storm but no memory it uses the storm. Proof: same acceptance file.
- [x] SC-3: `/today` for a CCDV-F learner shows a Readiness card: per domain the weather word + icon, the forecast %, the storm % or "no storm yet", and the overall line with the 72% reference labelled "approx.". Proof: browser on port 3001, light and dark, screenshot noted in evidence.
- [x] SC-4: The non-exam sample pack (`team-onboarding-sample`) gets no readiness (`readiness()` returns `null`), so no card renders. Proof: acceptance test loading the real pack file.
- [x] SC-5: Component split (react-client-patterns), `pnpm typecheck && pnpm lint && pnpm test` and `pnpm build` pass. Proof: receipt in LOOP-VERIFY.md.

## Concerns

- C-1…C-3 resolved by the user 2026-11-04 (see above). None open.

## Preflight (2026-11-04)

- Baseline: `pnpm typecheck` OK · `pnpm lint` 399 files, no fixes · `pnpm test` 70 files / 270 tests pass.
- No proof wipes shared local state (no `db:reset`, no `supabase stop/start`). SC-3 uses the existing local stack and a seeded CCDV-F learner.
- Names checked: `react-client-patterns.md` (split), `ui-design.md` §1 (icons/badge), `package.json` has no `ticket:*` scripts → FREEZE/VERIFY/EVAL run by hand (skill defaults).

## Out of Scope

- Scaled-score estimates, group readiness, post-exam calibration (retro after Dec 7).
- Storm data itself (MF-0013).

## Open questions

- none.

## Iteration Log

<!-- append-only -->
- 2026-11-04 it0: DESIGN with user (C-1..C-3 decided, SCs frozen, 7 red) → BUILD engine + card + page → TEST: receipt DONE, browser light/dark. Hand-off.
