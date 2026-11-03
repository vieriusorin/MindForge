---
paths:
  - "src/**/*.tsx"
---

# Composition Patterns: Slots, Render Functions, HoCs

**Normative from 2026-11-03.** How components are combined. Default to the first row that fits
and move down only with the stated reason. How-to and worked examples: the
`react-client-patterns` skill ("Escape hatches") and `react-feature-architecture`
("Compose at the page").

## The ladder

| # | Pattern | Use when | Server ↔ client safe? |
|---|---|---|---|
| 1 | **Plain props** | the child just needs data | yes (serialisable DTOs) |
| 2 | **`children` / named `ReactNode` slots** | the parent arranges parts it doesn't own (`tasks={<TaskTable …/>}`) | yes, and this keeps server parts on the server |
| 3 | **Compound components** (`Card` + `CardHeader`…) | a family of parts shares one visual contract | yes, if no shared state. With shared state, the root is a client component and the parts read it via a context **inside that folder only** |
| 4 | **Custom hook** | behaviour reused across components | client only |
| 5 | **Render prop / children-as-function** | the parent owns state the child must read **and** the markup varies per call site (a headless list yielding `(row) => ReactNode`) | **client → client only** |
| 6 | **Higher-Order Component** | a cross-cutting client concern applied to many components with no per-call variation (error boundary, analytics) | client only |

## Slots

- Name a slot for what it holds (`members`, `forest`, `actions`). Use `children` only for the
  single main content.
- A page composes feature components through slots instead of a feature component importing and
  fetching another feature.
- A slot is a `ReactNode`. If the child needs data from the parent, pass the data, not a function.

## Render functions

- **Inside one Server Component module**, a dispatch table of render functions is allowed
  (`{ ready: (d) => <X d={d} />, empty: () => <Empty /> }`), because the function is called during
  this render and never passed as a prop.
- **Never** pass a function prop from a Server Component to a Client Component. It isn't
  serialisable. The only exception is a Server Action.
- **No `renderFoo()` helpers inside a component body** that return large JSX. Extract a child
  component (in the folder's `components/`), so it has its own props type and can be named in
  React DevTools.
- Type render props explicitly in `types.ts`: `renderItem: (item: Item) => ReactNode`.

## Higher-Order Components

- Allowed only per row 6. Name it `with<Concern>` in `with-<concern>.tsx`. It forwards all props
  unchanged and sets a `displayName`.
- **Never** wrap a Server Component (it forces the subtree client-side).
- **Never** use an HoC (or a client hook) for authorization. Capability checks happen
  server-side in the page and the action. A client gate is UX only.
- Prefer a hook or a wrapper component (`<ErrorBoundary>`) when the concern needs any per-call
  configuration.

## Polymorphism and variants

- For element swapping, use shadcn's `asChild` (Radix `Slot`). Don't hand-roll an `as` prop.
- Visual variants go through `cva` in the shadcn primitive or `className` + tokens. Don't add a
  boolean prop per variant (`isPrimary`, `isLarge`).

## Forbidden

| Pattern | Why |
|---|---|
| Prop drilling a value more than two levels | use a slot, or the URL for page state |
| Context used as a data cache | the RSC props or the TanStack cache own server data |
| `React.cloneElement` / `Children.map` to inject props | fragile and invisible, so use explicit props or compound parts |
| Components defined inside another component's body | they remount every render and lose state |
| `forwardRef` in new code | React 19 passes `ref` as a normal prop |
