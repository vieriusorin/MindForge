---
name: p4t-react-client-patterns
description: P4T component split rules: the per-component folder under src/modules/<f>/components/<name>/ (index.ts barrel, <name>.tsx presentational, types.ts, utils.ts, hooks/use-<name>.ts), what each file may and may not hold, when to hoist a type or helper up to the module, the RSC-page-is-the-container rule, hook return-interface rules and the react-hook-form control/register/errors carve-out, and the allowed escape hatches (render props, HoC). Load before creating or editing any component under src/modules/, any page.tsx, or any use-*.ts hook.
---

# React Client Patterns — separation of concerns inside a component

Companion to `react-feature-architecture.md` (which decides *which module* a file belongs to) and
`nextjs-data.md` (which decides *what runs where*). This file decides, for one component, **what
gets split out of it and into which file**.

Applies to every new or touched component under `src/modules/**` and every `page.tsx`. It is not a
mandate to sweep files nobody is editing.

## The default split — a per-component folder

Each component gets its **own folder** under `src/modules/<f>/components/<name>/`. Everything that
belongs to that one component — its markup, its behaviour, its local types, its pure helpers —
lives colocated inside that folder. A barrel `index.ts` re-exports the public symbol so importers
keep the stable path `@/modules/<f>/components/<name>`.

```
src/modules/<f>/components/<name>/
  index.ts                 barrel: export { <Comp> } from "./<name>";
  <name>.tsx               the presentational component (markup only)
  types.ts                 boundary types for THIS component
  utils.ts                 pure helpers for THIS component (omit if none)
  hooks/use-<name>.ts      client behaviour (omit for a presentational component)
```

| File | Holds | Never holds |
|---|---|---|
| `src/app/**/page.tsx` | the **container**: `await params`/`searchParams`, auth (`getCurrentIdentity`), the parallel reads, role gates, `notFound()` / `redirect()`, slot wiring | JSX layout beyond the slot call, `"use client"`, arithmetic on figures |
| `components/<name>/index.ts` | the **barrel** — re-exports the component (and any named export other files import) so import paths stay `@/modules/<f>/components/<name>` | logic of any kind |
| `components/<name>/<name>.tsx` | the **presentational** component: markup, shadcn primitives, className | data reads, `getUser()`, role derivation, Server Action calls |
| `components/<name>/hooks/use-<name>.ts` | client **behaviour**: `useForm`, `useState`, `useQuery`, mutation + toast + `router` handling | JSX, pure decision logic |
| `components/<name>/utils.ts` | **pure** helpers this component calls: gates, schema selection, default-value builders, label/derivation functions | React, hooks, DB access, `fetch` |
| `components/<name>/types.ts` | every `interface`/`type` crossing a boundary **inside this component** | types used inside one function body |

Relative imports inside the folder: component → `./types`, `./utils`, `./hooks/use-<name>`; hook →
`../types`, `../utils`; utils → `./types`. `import type` for type-only imports.

### Child components → a nested `components/` subfolder

When a component is split into smaller **presentational sub-components** (a table row, a badge
cluster, a confirm dialog, one of several forms a dialog switches between), those child `.tsx` files
go in a `components/` subfolder **inside** the component's own folder. The parent stays at the folder
root as the container.

```
components/<name>/
  index.ts                 barrel → <Comp>
  <name>.tsx               container / shell
  types.ts                 boundary types — of the parent AND its children
  utils.ts                 pure helpers (optional)
  hooks/use-<name>.ts      behaviour (optional)
  components/              ← child presentational pieces, folder-internal
    <child-a>.tsx
    <child-b>.tsx
```

- No barrel for the children — the parent imports each by path; they are never imported from outside
  the folder.
- A child's props interface lives in the folder's single `types.ts`, not a per-child types file.
- Relative imports from a child: sibling child → `./<other-child>`; up to the folder's own
  `types`/`utils`/`hooks` → `../types`, `../utils`, `../hooks/use-<name>`.

Reference: `request-type-dialog/` (create + edit forms) and `tipuri-cereri-section/` (row + badges +
confirm dialog).

### Shared across components → hoist to the module

The folder is for what belongs to **one** component. The moment a second component in the same
feature needs a type or a pure helper, it moves **up** out of the folder:

| Shared by 2+ components in one feature | Lives at |
|---|---|
| a type crossing more than one component | `src/modules/<f>/types.ts` |
| a pure helper used by more than one component | `src/modules/<f>/utils/<surface>.ts` |

Do not pre-hoist in anticipation of a second consumer — promote on the second consumer, not before.
And `src/lib/` is still one level further out: it is for helpers a *second feature* imports (§`utils/`
boundaries below).

Reference implementation (per-component folder): `components/alerte-section/` →
`alerte-section.tsx` + `hooks/use-alerte-section.ts` + `utils.ts` + `types.ts` + `index.ts`.
(The earlier LS-0089 `angajati/[id]` split predates this layout — same file roles, flat instead of
foldered; new and touched components use the folder.)

### Nested `<Suspense>` sections stay in the page file

A page may declare a second async Server Component beside its default export, rendered under its
own `<Suspense>` so an expensive or period-keyed read streams independently (`nextjs-data.md` §2).
`ExpenseSection` in `santiere/[id]`, `CasareReportSection` in
`inventar/depozite/[id]/casare`, and the dashboard's `DashboardContent` are the existing cases.

Such a section **is a container** — it reads, so it belongs in the page file, not in `modules/`.
It does not get exported and it does not get a hook. What still moves out of it: its fallback
(a skeleton is markup → `components/`) and any row mapping or formatting it does → `utils/`.

### `utils` — pure decisions

A helper goes in a `utils` file when it is **pure** (same input, same output; no React, no I/O, no
clock). Splitting it out is what makes the hook readable: the hook becomes wiring, the utils file
holds the decisions, and the decisions become testable without rendering. `getEmployeeFormGates`,
`pickEmployeeFormSchema`, `buildEmployeeFormDefaults`, `isEmployeeFormComplete` are the reference
set.

Which file, by scope:

- **One component** → `components/<name>/utils.ts` (colocated, the flat `utils.ts` name is correct
  here — the folder already names the surface).
- **Two+ components in one feature** → hoist to `src/modules/<f>/utils/<surface>.ts`, named after
  the surface (`employee-form.ts`, `transfer-state.ts`), never a bare `modules/<f>/utils.ts`.

Boundaries:

- **Not** `src/lib/`. `lib/` is for helpers a *second feature* actually uses (`format.ts`,
  `contract-types.ts`, `validation/report-params.ts`). Promote to `lib/` on the second *feature*
  consumer, not in anticipation of one.
- **Not** a home for anything impure. A clock read, a `fetch`, a Server Action call, or a
  `use*` call disqualifies it — those stay in the hook or the container.
- One-off logic used in exactly one place inside one function stays inline.

### Server side — same idea, different names, one carve-out

The server layer already has this split; do not add a parallel `utils/` folder that competes
with it.

| Server concern | Where |
|---|---|
| a read (Drizzle query returning rows) | `src/server/services/<f>/<verb>-<noun>.ts` |
| pure domain logic shared by several services in one feature | `src/server/services/<f>/utils/<name>.ts` |
| **any figure that also appears in an export** | `src/server/services/cost-engine/` — **never** a `utils/` copy |
| capability checks, DTO field-stripping | `src/server/authz/` |

The carve-out is the calculation-parity invariant (`CLAUDE.md`, `react-feature-architecture.md`):
salarii, diurnă, cazare, cost/km, casare totals come from one cost-engine function called by both
the RSC page and `app/api/export/[report]`. A "small helper" in `services/<f>/utils/` that
recomputes part of a figure is exactly how screen and export drift.

Create `services/<f>/utils/` only when a second service in the same feature needs the helper, or
when a service file has grown to the point where its pure logic is hard to find. A single service
keeps its private helpers in its own file.

### Container / Presentational — the RSC page **is** the container

Do not add a `*-container.tsx`. Under the App Router the Server Component page already is the
container: it is the only place that may read, authorize, and decide. A presentational component
receives everything as props (data or `ReactNode` slots) and can be rendered with hand-written
props in isolation. If a component in `modules/` fetches or authorizes, it is in the wrong layer.

### Hooks — required for any client component with behaviour

If a `"use client"` component contains any of: `useForm`, more than one `useState`, an effect, a
`useQuery`/`useMutation`, or an `async` submit handler — that behaviour moves to
`hooks/use-<name>.ts` and the component keeps only JSX.

Hook rules (extending `typescript.md`):

- Explicit return interface in `types.ts`, named `Use<Name>Return`.
- **Never return raw setters or the raw library object.** Return `onSubmit`, not `handleSubmit`
  plus `setValue` plus `setError`. The view renders and submits; it does not drive state.
- Return **derived values** (`isComplete`, `isAdminViewer`, `tarifOrarLabel: string | null`), not
  the inputs the view would have to re-derive them from. A ternary chain in JSX is a hook that was
  not extracted. Where a boolean would leave a TypeScript narrowing guard behind in the markup
  (`flag && employee && "tarifOrar" in employee`), return the finished value instead of the flag.
- The hook may call Server Actions and `useRouter`; it may not read the DB.

#### Carve-out: `control` / `register` / `errors` are the react-hook-form seam

A form hook **may** return `control`, `register` and the resolved `errors` object. This is a
deliberate exception to "never return the raw library object", not a lapse.

The reason is structural, and it follows from `ui-shadcn.md`: this repo has no shadcn `Form`
wrapper. The `Field` family is purely presentational — there is no `FormProvider`, and `src/`
contains zero `useFormContext` calls — so nothing in the markup can reach the form instance out
of context. `Controller` needs `control`, an uncontrolled `<Input>` needs the `register` spread,
and `FieldError` needs the resolved error for its field. If the hook withholds them, the form
cannot be assembled at all; the only way to "comply" would be to move `useForm` back into the
component, which is the larger violation.

What the prohibition still covers, and why: those three are **plumbing the view must hold to
render**, whereas the banned members let the view *drive* state behind the hook's back.

| Returning | Verdict |
|---|---|
| `control`, `register`, `errors`, `onSubmit`, `isSubmitting` | sanctioned — the seam plus derived state |
| `setValue`, `setError`, `reset`, `trigger`, `watch` | forbidden — the view starts mutating form state |
| the whole `formState` object | forbidden — destructure `errors` / `isSubmitting` / `isDirty` out of it and return those |
| `handleSubmit` | forbidden — wrap it and return `onSubmit`, so the success path (toast, `router.refresh()`, `onSuccess`) stays in the hook |
| a raw `useState` setter | forbidden, unchanged |

`admin/components/alerte-section/hooks/use-alerte-section.ts` is the reference shape:
it returns `{ control, onSubmit, errors, isSubmitting }` — the seam, plus values already
destructured out of `formState`, and never `handleSubmit` itself.

The requirement to return **derived** values is unchanged by this carve-out. `control` and
`errors` travelling to the view is not licence for the view to compute anything from them: a
label, a gate or a disabled-condition derived from form state is still the hook's job.

A component with no behaviour (a table fill, a card, a slot) does **not** get a hook. Do not create
`use-x.ts` that only forwards props.

### Types

- Props interfaces, hook return interfaces, and form-value shapes used by **one component** →
  that component's `components/<name>/types.ts`.
- The same shapes once a **second component** in the feature imports them → hoist to
  `src/modules/<f>/types.ts`.
- Domain row/DTO types stay where they are defined (`server/db/schema/**`, `server/authz/dto.ts`);
  a `types.ts` imports them, never redefines them.
- Feature-agnostic shared types stay in `src/lib/`.
- One-off local types stay inline. A `types.ts` is a boundary file, not an attic.

### Param parsing

Route-segment and `searchParams` parsing lives in `src/lib/validation/report-params.ts`, as a pure
function taking the request-time clock read as an argument (`trailingWindowStart(today, days)`).
A `Date.now()` in an RSC body trips `react-hooks`' impure-function-during-render rule.

## Escape hatches — allowed, not defaults

Both of the following are legitimate in narrow cases. Neither is a starting point, because
`ReactNode`-slot composition already covers what they are usually reached for, and both push the
`"use client"` boundary upward if applied across an RSC seam.

**Render Props / children-as-function.** Use only when the parent owns state the child must read
*and* the child's markup varies per call site — e.g. a headless list that yields `(row) => JSX`.
Prefer a `ReactNode` slot whenever the parent does not need to pass anything down. Never across a
Server/Client boundary: a function prop is not serializable.

The one place this pays off in practice is a **dispatch table inside a single Server Component
module** — `rapoarte/[report]/page.tsx` maps six slugs to `{ assert, resolve, empty }`, where
`resolve`/`empty` are render functions returning `ReactNode`. That is legal precisely because the
function is *called during this render*, never passed as a prop, so nothing crosses a boundary.
Reach for it when several route branches differ only in which component and which required params
they use; the guard that decides "ready vs empty" then exists once instead of once per branch.

**Higher-Order Components.** Allowed only for a genuinely cross-cutting client concern applied to
many components with no per-call variation (an error boundary wrapper, an analytics wrapper). For
anything else use a hook — React 19 removed the `forwardRef` ceremony HoCs existed to paper over,
and an HoC around a Server Component forces the whole subtree client-side. Never use an HoC for
authorization: capability checks belong in `server/authz/`, asserted server-side; a client wrapper
is a UX gate at best.

## Forbidden

| Pattern | Why |
|---|---|
| Data fetching inside a `modules/` component | waterfall; `react-feature-architecture.md` |
| `*-container.tsx` beside a presentational file | the RSC page is the container |
| Hook returning `setState`/`setValue`/`formState` raw | `typescript.md`; the view starts driving state |
| Props/return interfaces declared inline in a component file once a second file imports them | duplicate drift |
| HoC wrapping a Server Component | drags `"use client"` up the tree |
| Render prop passed from a Server to a Client Component | not serializable |
| An authorization HoC or authorization hook as the only check | authz is server-side (`server/authz/`) |
