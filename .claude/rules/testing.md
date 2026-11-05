# Testing

**Normative from 2026-11-03.** Vitest with three projects: `unit` (`*.test.ts`, node), `ui`
(`*.test.tsx`, jsdom + React Testing Library) and `db` (`*.db.test.ts`, local Supabase).
How-to: the `testing-strategy` and `tdd` skills.

## What gets tested where

| Code | Test | Command |
|---|---|---|
| `src/engine/**` | every exported decision, in `__tests__/<file>.test.ts` | `pnpm test` |
| `src/lib/**`, component `utils.ts` | every export (`react-client-patterns` rule 4) | `pnpm test` |
| `src/server/**` pure helpers | `__tests__/<file>.test.ts` | `pnpm test` |
| RLS policies, grants, DB-backed reads | `__tests__/<file>.db.test.ts` against the **local** stack | `pnpm test:db` |
| Frozen ticket success criteria | `mf-<id>-<topic>.acceptance.test.ts` | either |
| Client hooks with branching (success/error paths, navigation, cache sync) | `__tests__/use-<name>.test.tsx` with `renderHookWithProviders` | `pnpm test` (project `ui`) |
| Client components with interaction (forms, dialogs, toggles, lists with actions) | `__tests__/<name>.test.tsx` with `renderWithProviders` + `user-event` | `pnpm test` (project `ui`) |
| Pure presentational components (markup from props) | none needed. Check them in the browser | |

Component and hook tests (ADR 0002):
- Use the helpers in `@/test/render`. They build the QueryClient from the app's `makeQueryClient()`
  with retries off. Never hand-roll a provider tree.
- Query the way a user would: `getByRole`, `getByLabelText`, `findByText`. Use `data-testid` only
  when there is no accessible handle, and treat that as an a11y smell to fix first.
- Act with `user-event` (`user.type`, `user.click`), not `fireEvent`.
- Mock at the facade: `vi.mock("next/navigation")`, `vi.mock("@/features/<f>/actions")`, and the
  nuqs testing adapter (`nuqs/adapters/testing`) for URL state. Never mock the hook under test
  or react-hook-form.
- One test per user-visible outcome: valid submit, client validation error, server field error,
  network failure, pending and disabled state.
- Decisions still go to `utils.ts` and get plain unit tests. A component test that asserts a
  computed value is a sign the computation lives in the wrong file.

msw and Playwright are not installed. Ask before adding any further test toolchain.

## Rules

- Tests live in a co-located `__tests__/` folder, never beside the source file.
- Assert behaviour and decisions (inputs → output), not calls. No snapshot tests.
- Inject the clock and randomness, and never depend on today's date.
- Mock at the facade (`src/server/supabase/*`, `fetch`), never deep inside a module. Prefer no
  mocks for engine code.
- DB tests seed what they need and run serially (configured). Never point them at a remote project.
- **Acceptance tests are frozen.** A builder never edits a `*.acceptance.test.ts` to make it pass.
  If it is wrong, stop and say so.
- A bug fix starts with a failing test that reproduces it.
- A figure shown in two places (screen and export, chart and table) gets a parity test that
  both read the same engine function.

## Before hand-off

`pnpm typecheck && pnpm lint && pnpm test`. Add `pnpm test:db` when touching `supabase/**` or
`src/server/**`, `pnpm build` when touching UI, and `pnpm check:packs` when touching `packs/**`
(MF-0036: every line of a cuckoo except its flaw must be grounded in a cited source).
