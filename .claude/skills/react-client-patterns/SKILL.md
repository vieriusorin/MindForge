---
name: react-client-patterns
description: Component split rules for React / Next.js App Router apps — the per-component folder (index.ts barrel, <name>.tsx presentational, types.ts, utils.ts, hooks/use-<name>.ts), what each file may and may not hold, when to hoist a type or helper up to the feature, the RSC-page-is-the-container rule, hook return-interface rules and the react-hook-form control/register/errors carve-out, and the allowed escape hatches (render props, HoC). Load before creating or editing any feature component, any page.tsx, or any use-*.ts hook.
---

# React Client Patterns — separation of concerns inside a component

Companion to `react-feature-architecture` (which decides *which feature* a file belongs to) and
`nextjs-data` (which decides *what runs where*). This skill decides, for one component, **what
gets split out of it and into which file**. `react-component-split` is the step-by-step how-to.

Applies to every new or touched component under the feature UI root and every `page.tsx`. It is
not a mandate to sweep files nobody is editing.

## Project bindings

Resolve from `CLAUDE.md` / `AGENTS.md`, `package.json` and the existing code. The code wins.

| Binding | What to look for | Default if absent |
|---|---|---|
| Feature UI root | where feature components live | `src/modules/<f>/` |
| Services root | where reads / domain logic live | `src/server/services/<f>/` |
| Authz layer | capability checks, DTO field-stripping | `src/server/authz/` |
| Figures engine | the one home for derived business figures | see `react-feature-architecture` |
| Shared helpers | feature-agnostic helpers and types | `src/lib/` |
| Form wrapper | is shadcn `Form` / `FormProvider` / `useFormContext` in use? | assume **not** — Field family wired by hand |
| Component test libs | `@testing-library/react`, `jsdom`, `happy-dom` in devDependencies | assume absent → logic in `.tsx` is untestable |
| Enforcement gate | a lint/gate script checking this layout or hook returns | none — if one exists, run it before handing off |
| Reference components | an already-split component in this repo to copy | none — follow the layout below |

## The default split — a per-component folder

Each component gets its **own folder** under `<ui-root>/<f>/components/<name>/`. Everything that
belongs to that one component — markup, behaviour, local types, pure helpers — lives colocated.
A barrel `index.ts` re-exports the public symbol so importers keep a stable path.

```
<ui-root>/<f>/components/<name>/
  index.ts                 barrel: export { <Comp> } from "./<name>";
  <name>.tsx               the presentational component (markup only)
  types.ts                 boundary types for THIS component
  utils.ts                 pure helpers for THIS component (omit if none)
  hooks/use-<name>.ts      client behaviour (omit for a presentational component)
```

| File | Holds | Never holds |
|---|---|---|
| `app/**/page.tsx` | the **container**: `await params`/`searchParams`, auth, the parallel reads, role gates, `notFound()` / `redirect()`, slot wiring | JSX layout beyond the slot call, `"use client"`, arithmetic on figures |
| `components/<name>/index.ts` | the **barrel** — re-exports the component (and any named export other files import) | logic of any kind |
| `components/<name>/<name>.tsx` | the **presentational** component: markup, UI primitives, className | data reads, session lookup, role derivation, Server Action calls |
| `components/<name>/hooks/use-<name>.ts` | client **behaviour**: `useForm`, `useState`, `useQuery`, mutation + toast + `router` handling | JSX, pure decision logic |
| `components/<name>/utils.ts` | **pure** helpers: gates, schema selection, default-value builders, label/derivation functions | React, hooks, DB access, `fetch` |
| `components/<name>/types.ts` | every `interface`/`type` crossing a boundary **inside this component** | types used inside one function body |

Relative imports inside the folder: component → `./types`, `./utils`, `./hooks/use-<name>`; hook →
`../types`, `../utils`; utils → `./types`. `import type` for type-only imports.

### Child components → a nested `components/` subfolder

When a component splits into smaller **presentational sub-components** (a table row, a badge
cluster, a confirm dialog, one of several forms a dialog switches between), the child `.tsx` files
go in a `components/` subfolder **inside** the component's folder. The parent stays at the root.

```
components/<name>/
  index.ts  <name>.tsx  types.ts  utils.ts?  hooks/use-<name>.ts?
  components/              ← child presentational pieces, folder-internal
    <child-a>.tsx
    <child-b>.tsx
```

- No barrel for the children — the parent imports each by path; nothing outside imports them.
- A child's props interface lives in the folder's single `types.ts`, not a per-child types file.
- From a child: sibling → `./<other-child>`; up → `../types`, `../utils`, `../hooks/use-<name>`.

### Shared across components → hoist to the feature

The folder is for what belongs to **one** component. The moment a second component in the same
feature needs a type or pure helper, it moves **up** out of the folder:

| Shared by 2+ components in one feature | Lives at |
|---|---|
| a type crossing more than one component | `<ui-root>/<f>/types.ts` |
| a pure helper used by more than one component | `<ui-root>/<f>/utils/<surface>.ts` |

Do not pre-hoist — promote on the second consumer, not before. The shared-helpers root is one level
further out: it is for what a *second feature* imports.

### Nested `<Suspense>` sections stay in the page file

A page may declare a second async Server Component beside its default export, rendered under its
own `<Suspense>` so an expensive or period-keyed read streams independently (`nextjs-data`).

Such a section **is a container** — it reads, so it belongs in the page file, not the UI root. It
is not exported and gets no hook. What still moves out: its fallback (a skeleton is markup →
`components/`) and any row mapping or formatting → `utils/`.

### `utils` — pure decisions

A helper goes in `utils` when it is **pure** (same input, same output; no React, no I/O, no
clock). Splitting it out makes the hook readable: the hook becomes wiring, utils holds the
decisions, and the decisions become testable without rendering — which, when no component test
library is installed, is the *only* way they are testable. Typical set for a form:
`getUserFormGates`, `pickUserFormSchema`, `buildUserFormDefaults`, `isUserFormComplete`.

- **One component** → `components/<name>/utils.ts` (the folder already names the surface).
- **Two+ components in one feature** → `<ui-root>/<f>/utils/<surface>.ts`, named after the
  surface (`user-form.ts`, `transfer-state.ts`), never a bare `<f>/utils.ts`.
- **Not** the shared-helpers root until a second *feature* consumes it.
- **Not** a home for anything impure. A clock read, a `fetch`, a Server Action call or a `use*`
  call disqualifies it — those stay in the hook or the container.
- One-off logic used in exactly one place inside one function stays inline.

### Server side — same idea, different names, one carve-out

The server layer already has this split; do not add a parallel `utils/` folder that competes.

| Server concern | Where |
|---|---|
| a read (query returning rows) | `<services-root>/<f>/<verb>-<noun>.ts` |
| pure domain logic shared by several services in one feature | `<services-root>/<f>/utils/<name>.ts` |
| **any figure that also appears elsewhere (export, report, chart)** | the figures engine — **never** a `utils/` copy |
| capability checks, DTO field-stripping | the authz layer |

The carve-out is calculation parity: a "small helper" in `services/<f>/utils/` that recomputes
part of a figure is exactly how screen and export drift.

Create `services/<f>/utils/` only when a second service in the feature needs the helper, or a
service file has grown so its pure logic is hard to find.

### Container / Presentational — the RSC page **is** the container

Do not add a `*-container.tsx`. Under the App Router the Server Component page already is the
container: the only place that may read, authorize, and decide. A presentational component
receives everything as props (data or `ReactNode` slots) and can be rendered with hand-written
props in isolation. A feature component that fetches or authorizes is in the wrong layer.

### Hooks — required for any client component with behaviour

If a `"use client"` component contains any of: `useForm`, more than one `useState`, an effect, a
`useQuery`/`useMutation`, or an `async` submit handler — that behaviour moves to
`hooks/use-<name>.ts` and the component keeps only JSX.

Hook rules (extending `typescript-strict`):

- Explicit return interface in `types.ts`, named `Use<Name>Return`.
- **Never return raw setters or the raw library object.** Return `onSubmit`, not `handleSubmit`
  plus `setValue` plus `setError`. The view renders and submits; it does not drive state.
- Return **derived values** (`isComplete`, `isAdminViewer`, `rateLabel: string | null`), not the
  inputs the view would re-derive them from. A ternary chain in JSX is a hook that was not
  extracted. Where a boolean would leave a narrowing guard in the markup
  (`flag && user && "rate" in user`), return the finished value instead of the flag.
- The hook may call Server Actions and `useRouter`; it may not read the DB.

#### Carve-out: `control` / `register` / `errors` are the react-hook-form seam

A form hook **may** return `control`, `register` and the resolved `errors` object — a deliberate
exception to "never return the raw library object".

The reason is structural when there is no form-context wrapper (see bindings, and `ui-shadcn`):
the Field components are purely presentational, nothing in the markup can reach the form instance
from context. `Controller` needs `control`, an uncontrolled `<Input>` needs the `register` spread,
and `FieldError` needs the resolved error. Withhold them and the form cannot be assembled; the only
way to "comply" would be moving `useForm` back into the component — the larger violation. Do not
wrap them either; wrapping destroys RHF's type inference.

Those three are **plumbing the view must hold to render**; the banned members let the view
*drive* state behind the hook's back.

| Returning | Verdict |
|---|---|
| `control`, `register`, `errors`, `onSubmit`, `isSubmitting` | sanctioned — the seam plus derived state |
| `setValue`, `setError`, `reset`, `trigger`, `watch`, any `set<Foo>` | forbidden — the view starts mutating form state |
| the whole `formState` object | forbidden — destructure `errors` / `isSubmitting` / `isDirty` and return those |
| `handleSubmit` | forbidden — wrap it and return `onSubmit`, so the success path (toast, `router.refresh()`, `onSuccess`) stays in the hook |
| a raw `useState` setter | forbidden |

Reference shape: `return { control, onSubmit, errors, isSubmitting }` — the seam, plus values
already destructured out of `formState`, never `handleSubmit` itself.

The **derived** values rule still holds: a label, gate or disabled-condition derived from form
state is the hook's job, not the view's.

A component with no behaviour (a table fill, a card, a slot) does **not** get a hook. Do not create
`use-x.ts` that only forwards props.

### Types

- Props, hook return interfaces and form-value shapes used by **one component** → its `types.ts`.
- Once a **second component** in the feature imports them → hoist to `<ui-root>/<f>/types.ts`.
- Domain row/DTO types stay where defined (DB schema, authz DTOs); a `types.ts` imports them,
  never redefines them.
- Feature-agnostic shared types stay in the shared-helpers root.
- One-off local types stay inline. A `types.ts` is a boundary file, not an attic.

### Param parsing

Route-segment and `searchParams` parsing lives in a shared validation module as a pure function
taking the request-time clock read as an argument (`trailingWindowStart(today, days)`). A
`Date.now()` in an RSC body trips `react-hooks`' impure-function-during-render rule.

## Escape hatches — allowed, not defaults

Both are legitimate in narrow cases. Neither is a starting point: `ReactNode` slots already cover
what they are usually reached for, and both push the `"use client"` boundary upward across an RSC
seam.

**Render Props / children-as-function.** Only when the parent owns state the child must read
*and* the child's markup varies per call site — e.g. a headless list yielding `(row) => JSX`.
Prefer a `ReactNode` slot when the parent passes nothing down. Never across a Server/Client
boundary: a function prop is not serializable.

Where it pays off: a **dispatch table inside a single Server Component module** — e.g. a
`reports/[report]/page.tsx` mapping slugs to `{ assert, resolve, empty }`, where `resolve`/`empty`
are render functions returning `ReactNode`. Legal because the function is *called during this
render*, never passed as a prop. Use it when route branches differ only in which component and
which required params they use; the "ready vs empty" guard then exists once.

**Higher-Order Components.** Only for a genuinely cross-cutting client concern applied to many
components with no per-call variation (error boundary, analytics wrapper). Otherwise use a hook —
React 19 removed the `forwardRef` ceremony HoCs papered over, and an HoC around a Server Component
forces the subtree client-side. Never an HoC for authorization: capability checks are asserted
server-side; a client wrapper is a UX gate at best.

## Forbidden

| Pattern | Why |
|---|---|
| Data fetching inside a feature component | waterfall; `react-feature-architecture` |
| `*-container.tsx` beside a presentational file | the RSC page is the container |
| Hook returning `setState`/`setValue`/`formState` raw | the view starts driving state |
| Props/return interfaces declared in a component file | `types.ts` owns them; hook and view drift otherwise |
| HoC wrapping a Server Component | drags `"use client"` up the tree |
| Render prop passed from a Server to a Client Component | not serializable |
| An authorization HoC or hook as the only check | authz is server-side |
