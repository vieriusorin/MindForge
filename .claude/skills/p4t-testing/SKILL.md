---
name: p4t-testing
description: P4T testing rules: Vitest and Playwright are installed and in active use (~148 test files); commands pnpm test, test:authz, test:e2e; write tests for services, lib and modules utils in co-located __tests__/; mock at the facade not deeper; DB-backed suites need pnpm db:seed; calculation-parity and SQL-level RLS coverage stay distinct from Playwright; no snapshot tests; React Testing Library and msw are NOT installed and must be proposed before adding. Load before writing tests or deciding a verification strategy.
---

# Testing — P4T

**Status: Vitest and Playwright are installed and in active use.**
There are ~148 test files under `src/**/__tests__/` plus a Playwright suite in `e2e/`.

Earlier revisions of this file said "no automated tests yet, do not add a framework unless
asked." That is out of date and was actively misleading — corrected LS-0139.

## What exists

| Layer | Tool | Where | State |
|---|---|---|---|
| Units, services, DB, RLS/authz | Vitest `4.1.10` (`vitest.config.ts`) | `src/**/__tests__/*.test.ts` | **In use** |
| End-to-end / route access | Playwright `^1.62.1` | `e2e/` (`route-access.spec.ts`, `flows/`, `auth.setup.ts`) | **In use** |
| Component tests (RTL) | `@testing-library/react` | — | **Not installed** |
| Network mocking (msw) | `msw` | — | **Not installed** |

Commands (from `package.json` — do not invent others):

```bash
pnpm test              # vitest run
pnpm test:authz        # vitest run src/server/authz  — the RBAC/RLS subset
pnpm test:e2e          # playwright test
pnpm typecheck         # tsc --noEmit
```

Coverage is concentrated where this project's risk is: `server/db` (24 files),
`server/services/pontaj` (14), `lib` (12), `inventar` (11), `flota` (11), `cereri` (10),
`cost-engine` (9), `authz` (8).

## Rules

### Write tests for server-side and pure code — that is the established pattern
New services in `src/server/services/`, pure helpers in `src/lib/` and
`src/modules/<f>/utils/`, and anything touching authz get a Vitest file in a co-located
`__tests__/` folder. This is not a new practice to propose; it is what the repo already does.

### Mock at the façade, not deeper
`src/server/services/identity/__tests__/get-current-identity.test.ts` is the reference: it
mocks `getAuthUser` at its module boundary (because `cookies()` cannot work outside a Next.js
request scope) and runs everything downstream — the `getScopedDb(...).rls(...)` join, RLS
enforcement, the returned shape — unmocked against the real local database.

### Database-backed tests need a seeded database
Several suites read seeded fixtures (`cod_angajat = 'SPK-ADM'`, `'SPK-LUC'`). Run `pnpm db:seed`
at least once, or they fail with an explicit message telling you so.

### Calculation parity deserves a test, and already has one
`src/server/services/rapoarte/__tests__/estimativ-plata-cost-parity.test.ts` guards the
screen/export parity invariant. Any new figure appearing in both a screen and an export should
extend this pattern rather than rely on review.

### RLS needs SQL-level coverage, not just Playwright
Playwright proves what the UI shows, not what the database would allow. `test:authz` and the
`server/db` suites are the layer that proves the policy. Keep them distinct.

### Before adding React Testing Library or msw — ask
These are the two pieces genuinely not installed. Component testing is a real gap, but adding
RTL + msw is a toolchain decision with a maintenance cost. Propose it; do not add it
unprompted. Note that under the App Router most logic should live in hooks and pure `utils/`
(`react-client-patterns.md`), which Vitest can already test without a DOM.

### No snapshot tests
They break on every Tailwind class change and assert nothing about behaviour.

### Test behaviour, not implementation
Assert what a caller observes. Romanian strings in UI assertions, matching the actual UI copy.

## Suggested gate for any change

```bash
pnpm typecheck && pnpm test && pnpm lint:all
```
