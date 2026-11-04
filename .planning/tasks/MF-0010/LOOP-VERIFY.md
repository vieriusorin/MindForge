---
ticket_id: MF-0010
iteration: 0
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
