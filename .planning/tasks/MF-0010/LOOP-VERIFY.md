---
ticket_id: MF-0010
iteration: 2
---

# LOOP-VERIFY — MF-0010

## Baseline (2026-11-04, before any change)

`pnpm typecheck` exit 0 · `pnpm lint` exit 0 · `pnpm test` 36 files / 133 tests passed.

## RED at freeze (2026-11-04T08:53:35Z)

- `src/engine/content/__tests__/mf-0010-seed-planting.acceptance.test.ts`: 11/11 fail with
  `Error: not implemented` (the `plan-seed-planting.ts` stub); identical on a 2nd run.
- `src/components/diagram-figure/__tests__/mf-0010-diagram-figure.acceptance.test.tsx`: 4/4 fail with
  `Error: not implemented` (the `diagram-figure.tsx` stub, `5| throw new Error("not implemented")`);
  identical on a 2nd run.
- TYPECHECK green with the stubs in place; `pnpm lint` green after `biome check --write` on both files.

## Receipt 2026-11-06 (branch `feat/MF-0010` at `main` 3d1f5ed + the working-tree diff)

Local stack: `pnpm dev:setup` (migrations up, keys synced) + `MF_AUTHOR_EMAIL=mf0010@test.local pnpm dev:seed --pack ccdv-f`.
No `db:reset`, no `supabase stop/start`.

| Gate | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 (632 files) |
| `pnpm test` | 153 files / 744 tests passed (both frozen MF-0010 files included) |
| `pnpm build` | exit 0 (after the fixes below) |
| `pnpm test:db` (seeded stack) | 27 files / 120 tests passed (no MF-0010 change; also shows MF-0045's storms fixture green on a seeded DB) |

### RED before the fixes

- **Edge labels (SC-2).** Dev, dark theme, `/play/ccdv-f/plant/D5.S1`: "low/medium/high" drew as black boxes.
  `getComputedStyle(.react-flow__edge-text).fill` = `rgb(0,0,0)`. The compiled rule was
  `.[&_.react-flow__edge-text]:fill-muted-foreground .react-flow edge-text`: Tailwind 4 reads `_` in an arbitrary
  variant as a space. Fix: `\_\_` in `flow-diagram.tsx` (also the attribution selector). After: text fill
  `muted-foreground` (dark `rgb(170,166,207)`, light `rgb(106,103,136)`), label background = canvas, 12px, in dev and
  in the prod build. No unit test: jsdom does not compile Tailwind; the proof is the browser, as SC-2 states.
- **Focusable link in the hidden drawing (SC-3).** React Flow's "React Flow" attribution `<a>` sat under `aria-hidden`
  and took focus. `src/components/diagram-figure/__tests__/diagram-figure.test.tsx` failed (1/1) with the fix stashed,
  passes with it. Fix: `inert` on the drawing wrapper. Chrome: `a.focus()` leaves `document.activeElement` = `BODY`.
  (jsdom/user-event ignore `inert`, so the test asserts the inert subtree; Tab order is proved in Chrome.)

### Success Criteria

| SC | Proof | Result |
|---|---|---|
| SC-1 | Chrome, `mf0010@test.local`: Temperature card with Simply, In nature, 4 "Where it breaks" lines as a plain list, Contrast, Why the name, source link; then the diagram; then "Quick check 1 of 2" | pass |
| SC-2 | Chrome, dark and light screenshots, labels readable after the fix. Prod build (`next start -p 3002`): the 19 initial `<script>` chunks of the plant page and of `/today` contain no React Flow code (markers `react-flow__renderer`/`xyflow`/`react-flow__pane`); control: the same markers are found in `3jgifqnipihsb.js`, loaded after hydration | pass |
| SC-3 | Frozen `mf-0010-diagram-figure.acceptance.test.tsx` green; Chrome: `figure` named by its `figcaption`, drawing under `aria-hidden` + `inert`, lists "Steps" (5) and "Connections" (4, labels in words) exposed | pass |
| SC-4 | Group page: seed tiles D2.S1, D2.S2, D2.S6, D5.S1, D7.S1 link "Plant this seed". D5.S1: 2 checks, 1 correct → `attempts` 0 → 2 (q1 t, q2 f), tile shows a sprout and no longer links. D7.S1: 3 checks, 0 correct → `attempts` 0 → 3, still a seed with its link | pass |
| SC-6 | Frozen `mf-0010-seed-planting.acceptance.test.ts` green | pass |
| SC-7 | Gates above | pass |
| SC-8 | New `walk-session.test.tsx` case (primer only on the new step, above its stem). Chrome, fresh `mf0010-fresh@test.local`: its first walk's new seed was D2.S5 (no card or diagram, so no primer, as designed). Fixture: one correct `record_attempt` (as that user, DB-graded) on D2.S5, D2.S4, D2.S3, D5.S2, D1.S2, the five skills heavier than D5.S1. Then the walk's new seed was D5.S1: nature card, then diagram (drawn), then the question | pass |

### Not verified

- The "Plant this seed" link from the landing page (by design there is none: anonymous user).
- Screen-reader output itself (NVDA/VoiceOver); the a11y tree and DOM were checked instead.
