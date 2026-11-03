---
paths:
  - "src/features/**/components/**"
  - "src/components/**"
  - "src/hooks/**"
  - "src/app/**/*.tsx"
---

# Client Side

**Normative from 2026-11-03.** Every `"use client"` file and the components around it. Which
state tool to use is settled in `state-and-data.md`. Folder layout and hook-return limits are in
`react-client-patterns.md`. Look and tokens are in `ui-design.md`. This file covers the
behaviour rules between them. How-to: `server-client-components`, `react-client-patterns`,
`vercel-react-best-practices`, `accessibility`.

## 1. The boundary

- A component is a Server Component unless it needs a hook, an event handler or a browser API.
  Put `"use client"` on the **smallest leaf**, never on a page, layout or a component that only
  arranges children.
- Pass server-rendered parts into a client component as `children` or named `ReactNode` slots
  instead of importing them inside it, so they stay on the server.
- Props crossing the boundary are serialisable DTOs: no functions (except Server Actions), class
  instances, `Date` objects (pass ISO strings), Supabase clients or unfiltered rows.
- Client files never import from `src/server/**`, `server-only` modules or `process.env`
  (other than `NEXT_PUBLIC_*`).

## 2. Effects

`useEffect` is for **synchronising with something outside React** (a DOM API, a subscription,
a timer, an `<audio>` element). It is never:

| Not for | Use instead |
|---|---|
| fetching data | RSC props or TanStack Query |
| deriving a value from props/state | compute it during render (or in `utils.ts`) |
| resetting state when a prop changes | a `key` on the component |
| reacting to a user action | the event handler |
| syncing to the URL | nuqs |
| notifying a parent of a change | call the parent's callback in the handler |

Every effect that subscribes, listens or starts a timer returns a cleanup. Every dependency is
listed, so don't silence the lint rule. For new code that reads an external store (media
query, `localStorage`, online status), prefer `useSyncExternalStore` over an effect + state.

## 3. State

- Keep state minimal. Never store what can be derived from props, other state, the URL or the
  query cache.
- Lift state only to the nearest common owner. If it would reach a page, it belongs in the URL (nuqs).
- Group related values that change together in one `useState` object or a `useReducer`, or
  model them as a discriminated union (`{ status: "idle" } | { status: "error"; message }`)
  rather than several booleans.
- React Context is for low-frequency, app-wide values (theme, query client). It is never a data
  cache or a substitute for props two levels down.

## 4. Rendering and performance

- No React Compiler is configured. Add `useMemo`/`useCallback`/`memo` only for a **measured**
  problem, or when a stable identity is required (an effect dependency, a memoised child).
  Don't add them by default.
- Use a stable domain id as the list `key`, never an array index for lists that reorder or filter.
- Heavy client-only modules (charts, editors) load through a `*-lazy.tsx` `next/dynamic` wrapper.
- Use `next/image` for raster images and `next/link` for internal navigation. Never use `<a href>`
  to an internal route.
- Don't read browser-only values (`window`, `localStorage`, `matchMedia`) during render. Read them
  in an effect or `useSyncExternalStore` with a server snapshot, so hydration matches.

## 5. Events and async UI

- Every async action shows pending state (`isPending`/`isSubmitting`) and disables its trigger to
  stop a double submit.
- Errors reach the user: a field error, a root `FieldError`, or a toast. Never swallow them in an
  empty `catch`.
- Use `useTransition` only for non-urgent UI updates (tab switch, filter). Writes go through
  `useMutation` (`state-and-data.md`).

## 6. Error and loading boundaries

- Each route segment that does per-user work has a `loading.tsx` or a `<Suspense>` fallback, plus
  an `error.tsx` that offers a retry.
- Skeletons match the final layout's size, so nothing jumps when data arrives.
- **Known gap (2026-11-03):** no `error.tsx` exists in `src/app` yet. Add one to a segment the
  next time it is touched (grandfathered until then, as in `state-and-data.md` "Migration").

## 7. Separation of concerns and SOLID

Any client component with logic uses the hook pattern (`react-client-patterns.md`): the view
renders, the hook orchestrates, `utils.ts` decides. SOLID per layer, including the client
column, is in `engineering-principles.md` §2. The client smells to watch for:

- a `.tsx` that fetches, validates, formats and renders
- a growing `if (type === …)` chain or a boolean prop per variant
- a wrapper that drops `disabled`, `type` or `aria-*`
- passing a whole DTO "in case", or a hook returning `setState`
- a view importing `actions.ts`, `useRouter` or `useQueryClient`

## 8. Accessibility (always)

- Use native elements first (`button`, `a`, `label`, `input`). Never a clickable `div`.
- Every control has an accessible name, and every `FieldLabel` has an `htmlFor` that matches.
- Focus stays visible and moves sensibly after dialogs, deletes and route changes.
- Async results and errors are announced (`aria-live` or the shadcn primitives that already do).
