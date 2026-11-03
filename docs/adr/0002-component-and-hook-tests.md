# Components and hooks are tested with React Testing Library

Decided 2026-11-03. Replaces the earlier stance that `@testing-library/react`, `jsdom` and `happy-dom` stay uninstalled and only pure modules are tested.

We added `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom` and `jsdom`, plus a Vitest project `ui` that runs `src/**/__tests__/**/*.test.tsx` in jsdom (`src/test/setup-dom.ts`). `pnpm test` runs `unit` and `ui`. `pnpm test:ui` runs `ui` alone. Helpers live in `src/test/render.tsx` and build the QueryClient from the app's own `makeQueryClient()` with retries off. The reference tests are in `src/features/groups/components/create-group-form/__tests__/`.

We chose this because the wiring between a view, its hook, react-hook-form, `useMutation`, the router and a Server Action had no automated check: a correct `utils.ts` and a correct action could still be connected wrongly. jsdom over happy-dom because Radix primitives are the most exercised in it.

**Consequences:** the component split (`react-client-patterns.md`) still holds. Decisions belong in `utils.ts`, and plain unit tests are still the first choice. Hook tests (`renderHook`) cover orchestration that branches, and component tests cover user flows and accessible names. Mock at the facades (`next/navigation`, the feature's `actions`), never the hook's internals. Component tests don't replace `pnpm build` (missing `<Suspense>`) or a browser check of the look.
