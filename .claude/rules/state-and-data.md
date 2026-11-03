# State & Data Stack

**Normative from 2026-11-03.** Every new or touched component, hook, page and action follows
this file. The how-to, with worked examples from this repo, is in the skills named per section:
`server-client-components` (the boundary), `client-data-tanstack-query`, `forms-rhf-zod`,
`nuqs-typescript-zod`. On a conflict this file wins; on a conflict with
`react-client-patterns.md` (folder layout, hook return rules), that file wins.

## Why

A Next.js app drifts into five ways of holding the same kind of state (`useState` + `useEffect`
fetch, `useActionState`, hand-built `router.push("?x=")`, Context caches, …) and then no
reviewer can tell which is right. One tool per kind of state makes the right answer
mechanical.

## 1. One tool per kind of state

| The state is… | Tool | Never |
|---|---|---|
| Data the first render needs | **RSC** read via `src/server/**`, passed as props | `useEffect` + `fetch`, a client fetch "to keep it simple" |
| Server data the client must refetch without navigating (poll, infinite list, filter that re-queries, optimistic list) | **TanStack Query** (`useQuery` / `useSuspenseQuery`) over a GET Route Handler | `useEffect` fetch, SWR, a Server Action used as a read |
| A write started from a client component | **`useMutation`** wrapping a Server Action | bare `startTransition(action)`, new `useActionState` |
| Anything that should survive reload, back button or a shared link: filter, tab, sort, page, search, selected id | **nuqs** parsers in `src/features/<f>/search-params.ts` | `useState`, `useSearchParams` + string building, `router.push("?…")` |
| Form input | **react-hook-form + zodResolver**, schema in `src/features/<f>/schemas.ts`, rendered with the shadcn `Field` family | uncontrolled `FormData` parsing, `useActionState`, shadcn `Form` wrapper |
| Ephemeral UI (popover open, hover, step in a local wizard) | `useState` inside the component's hook | — |
| Theme | `next-themes` | — |

No other client state library (Redux, Zustand, Jotai, SWR, Apollo, Formik). Adding one needs an
ADR in `docs/adr/`.

## 2. Server Components are the default

- A file is a Server Component unless it **needs** a hook, an event handler or a browser API.
  `"use client"` goes on the smallest leaf that needs it, never on a page or layout.
- `page.tsx` is the container: auth, parallel reads, `notFound()`, engine calls; it renders
  feature components with plain props. Per-user reads sit under `<Suspense>` with a real
  fallback (Cache Components; see `nextjs-data`).
- Client components never import from `src/server/**` and never receive a Supabase client,
  secrets or unfiltered rows. Props crossing the boundary are serialisable DTOs.

## 3. Mutations

- Every write is a Server Action in `src/features/<f>/actions.ts`: auth check, **re-parse the
  input with the shared zod schema** (`input: unknown`), then call the DB.
- Return `ActionResult` / `FormActionResult` from `src/lib/action-result.ts` (discriminate on
  `ok`). Validation failures return `formErrorFromZod(error)` so fields light up.
- An action called through `useMutation` does **not** `redirect()` on success; it returns the
  id and the hook navigates (`router.push`) in `onSuccess`. `redirect()` stays for the auth
  guard only.
- After success the hook syncs the screen: `queryClient.invalidateQueries` for TanStack data,
  `router.refresh()` or the action's `refresh()` / `updateTag()` for RSC data. Both, when the
  screen has both.

## 4. TanStack Query

- Provider and defaults come from `AppProviders` + `src/lib/query-client.ts`. Never construct
  a second `QueryClient` on the client; on the server use `makeQueryClient()`.
- Every query is defined once in `src/features/<f>/queries.ts` as a cache contract
  (`key`, `options` via `queryOptions`, optional `tag`). Components and hooks call
  `useQuery(xCache.options(...))`; no inline `queryKey` arrays.
- Client `queryFn`s call a GET Route Handler under `src/app/api/<feature>/…/route.ts` that
  calls the **same** `src/server/**` read the RSC uses. Server prefetch overrides `queryFn` to
  call that read directly.
- Query keys contain every input that changes the result (including nuqs values).

## 5. nuqs

- Parsers are declared once per feature in `search-params.ts`, with a `createLoader` export
  for the page. Any file both sides import (`search-params.ts`, `queries.ts`) imports from
  **`nuqs/server`**. The bare `nuqs` entry is `"use client"`, so its functions can't be
  called from an RSC. Only hooks (`useQueryStates`) import from `nuqs`.
- `shallow: true` (default) when only client code reads the param; the TanStack key picks it
  up. `shallow: false` when an RSC reads it. Pick one per param, never both.
- Every client component that calls `useQueryState(s)` renders inside a `<Suspense>`. It works
  in dev without one and **fails `next build`**.
- Free-text params use `limitUrlUpdates: debounce(300)`.

## 6. Forms

- `useForm({ resolver: zodResolver(Schema), defaultValues })` in `hooks/use-<name>.ts`. Types
  are inferred from the resolver; don't pass generics by hand.
- The hook exposes only the `react-hook-form` carve-out (`react-client-patterns.md` rule 6):
  `control`, `register`, `errors`, `onSubmit`, `isSubmitting` and derived values.
- Server errors go back onto the form with `applyFormError(form.setError, result.error)`;
  the view renders `errors.root?.server` in a `FieldError`.
- `register` for native inputs, `Controller` for `Select`, `Checkbox`, `RadioGroup` and any
  other Radix control. Every `FieldLabel` has `htmlFor` matching the control's `id`.

## Migration

Code written before this rule is grandfathered until it is touched. Touching it means
migrating it. Known: `auth/sign-in-form` (`useActionState`) and `duel/duel-session`
(`useTransition` + action). The reference implementation is
`src/features/groups/components/create-group-form/`.
