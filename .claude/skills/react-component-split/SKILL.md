---
name: react-component-split
description: Refactor a P4T page or component into container / presentational / hook / types files. Use when a component mixes fetching, role gating, form state and markup; when asked to "extract a hook", "separate concerns", "move the interfaces out", or to apply Container/Presentational, Render Props or HoC patterns.
---

# React Component Split — P4T

Normative source is `.claude/rules/react-client-patterns.md`. That rule wins on any
conflict; this skill is the how-to with worked before/after from this repo.

Reference commit: **LS-0089**, `angajati/[id]` — one 173-line page file became a container
page + presentational shell + presentational form + hook + types.

## Step 0 — classify the file first

Answer two questions before moving a line:

1. **Does it have `"use client"`?**
   - No → it is a Server Component. **Hooks are illegal here.** Its logic (auth, reads,
     role gates, `notFound()`) stays put; only *markup* and *types* move out.
   - Yes → behaviour moves to a hook.
2. **Is it a page (`src/app/**/page.tsx`)?**
   - Yes → it is the container. Never create a `*-container.tsx` beside it.

Do not skip step 0. Extracting a "hook" from a Server Component is the single most common
way this refactor goes wrong.

## Step 1 — the per-component folder

Each component gets its own folder under `components/<name>/`. Everything for that one component is
colocated; a barrel `index.ts` keeps the import path `@/modules/<f>/components/<name>` stable. The
container page stays where it is.

```
src/app/(dashboard)/admin/setari/page.tsx             container: params, auth, reads, gates
src/modules/admin/components/alerte-section/
  index.ts                                            barrel → AlerteSection
  alerte-section.tsx                                  presentational form (markup only)
  hooks/use-alerte-section.ts                         client behaviour (wiring)
  utils.ts                                            pure helpers (field descriptors)
  types.ts                                            boundary types for this component
```

Reference: `src/modules/admin/components/alerte-section/`. Relative imports inside the folder:
component → `./types`, `./utils`, `./hooks/use-<name>`; hook → `../types`, `../utils`; utils →
`./types`.

### Child components → a nested `components/` subfolder

When the component is split into smaller **presentational sub-components** (a table's row, a badge
cluster, a confirm dialog, one of several forms a dialog switches between), those child `.tsx`
files go in a `components/` subfolder **inside** the component's own folder. The parent stays at the
folder root as the container. There is no barrel for the children — the parent imports each by path;
they are folder-internal and never imported from outside the folder.

```
src/modules/admin/components/request-type-dialog/
  index.ts                              barrel → RequestTypeDialog
  request-type-dialog.tsx               container: the Dialog shell + mode switch
  hooks/use-request-type-dialog.ts      the two form hooks
  utils.ts                              zod schemas + inferred form-value types
  types.ts                              boundary types (props of parent AND children)
  components/                           ← child presentational pieces
    request-type-create-form.tsx
    request-type-edit-form.tsx
```

Reference: `request-type-dialog/` (two forms) and `tipuri-cereri-section/` (row + badges + confirm
dialog). Relative imports from a child: sibling child → `./<other-child>`; up to the folder's own
`types`/`utils`/`hooks` → `../types`, `../utils`, `../hooks/use-<name>`. A child's props interface
still lives in the folder's single `types.ts`, not a per-child types file.

**Shared → hoist up.** A type or pure helper used by a *second* component in the same feature moves
out of the folder to `src/modules/<f>/types.ts` or `src/modules/<f>/utils/<surface>.ts`. Promote on
the second consumer, not before. `src/lib/` is for what a second *feature* imports.

(The older LS-0089 `angajati/[id]` split is flat — `components/angajat-detail.tsx`,
`hooks/use-employee-form.ts`, module `types.ts`. Same file roles; new/touched components use the
folder layout above.)

## Step 2 — what moves out of a Server Component page

Move: the presentational wrapper (`AngajatDetail`) → `components/`, its props interface →
`types.ts`, param parsing → `src/lib/validation/report-params.ts` as a **pure** function.

Keep in the page: `await params` / `await searchParams`, `getCurrentIdentity()`,
`Promise.all([...])`, `notFound()` / `redirect()`, every role-derived boolean, the slot
wiring.

Trap: a `Date.now()` moved into an RSC body trips
`react-hooks` → `Error: Cannot call impure function during render`. Read the clock once
(`const today = new Date().toISOString().slice(0, 10)`) and pass it into pure helpers:

```ts
// src/lib/validation/report-params.ts
export const trailingWindowStart = (today: string, days: number): string => ...
export const parseTrailingRange = (from: unknown, to: unknown, opts: {...}): ReportRange => ...
```

## Step 3 — extracting the hook (client only)

Everything that is not JSX goes in. For `employee-form.tsx` that was: schema selection,
`defaultValues`, `useForm`, the `requiredFieldNames`/`watch()` completeness gate, and the
`handleSubmit` body with its Server Action call, `toast`, and `router` navigation.

Before:

```tsx
export function EmployeeForm({ mode, employee }: EmployeeFormProps) {
  const router = useRouter();
  const isCreate = mode === "create";
  const schema = isCreate ? employeeCreateSchema : ...;
  const { control, register, handleSubmit, setError, watch, formState } = useForm(...);
  const onSubmit = handleSubmit(async (values) => { ... });
  return <form onSubmit={onSubmit}> ...200 lines... </form>;
}
```

After:

```tsx
export function EmployeeForm({ mode, employee }: EmployeeFormProps) {
  const { control, register, onSubmit, errors, isSubmitting, isComplete,
          isCreate, isAdminViewer, hasContactSection, showReadonlyTarif } =
    useEmployeeForm({ mode, employee });

  return <form onSubmit={onSubmit}> ...markup only... </form>;
}
```

Two things that make this a real split rather than a move:

- **`onSubmit` is already wrapped.** The hook returns the bound handler, not
  `handleSubmit` + `setError`. The view cannot set form state.
- **Derived values are returned, not their inputs.** `tarifOrarLabel: string | null`
  replaced an inline `isAdminViewer && employee && "tarifOrar" in employee ?
  formatTarifOrar(employee.tarifOrar) : null` in JSX. Returning a *boolean* here would not
  have been enough: the view would still need `employee && "tarifOrar" in employee` for
  TypeScript to narrow `employee.tarifOrar`. When a flag leaves a narrowing guard behind in
  the markup, return the finished value instead of the flag.

Keep `"use client"` at the top of the hook file. It does not prevent a Server Component
from importing the module — that fails later, when `useForm` runs during a server render.
It is a convention that marks the boundary for readers and for the bundler.

## Step 3b — push the pure decisions down into `utils/`

Once the hook exists, most of it is usually not wiring. Anything with no React in it — gates,
schema selection, defaults, required-field lists, completeness checks — moves again, to
`src/modules/<f>/utils/<surface>.ts`:

```ts
// src/modules/employees/utils/employee-form.ts — no React, no I/O, no clock
export const getEmployeeFormGates = (mode, employee): EmployeeFormGates => ...
export const pickEmployeeFormSchema = ({ isCreate, isAdminViewer }) => ...
export const buildEmployeeFormDefaults = (employee, { hasContactSection }) => ...
export const getRequiredEmployeeFields = ({ isCreate, isAdminViewer }) => ...
export const isEmployeeFormComplete = (values, requiredFields) => ...
```

The hook shrinks to what it is actually for:

```ts
const gates = getEmployeeFormGates(mode, employee);
const { control, register, handleSubmit, setError, watch, formState } = useForm({
  resolver: zodResolver(pickEmployeeFormSchema(gates)),
  defaultValues: buildEmployeeFormDefaults(employee, gates),
  mode: "onChange",
});
const isComplete = isEmployeeFormComplete(watch(), getRequiredEmployeeFields(gates));
```

Do not move impure things there — a clock read, a `fetch`, a Server Action call, or anything
calling a `use*` hook stays in the hook. Do not pre-promote to `src/lib/`: that is for helpers a
*second feature* actually imports.

Server side, the equivalent already exists as `src/server/services/<f>/`; add
`services/<f>/utils/` only when a second service in the same feature needs the helper. The hard
exception is any figure that also lands in an export — that stays in
`server/services/cost-engine/`, called by both the page and the export route, or screen and export
drift.

## Step 4 — types.ts

Move only what crosses a boundary: props interfaces, the hook's `Use<Name>Return`, the
form-values shape. Import DTOs, do not redeclare them:

```ts
import type { EmployeeDTO } from "@/server/authz/dto";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";

export interface UseEmployeeFormReturn {
  control: Control<EmployeeFormValues>;
  register: UseFormRegister<EmployeeFormValues>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  errors: FieldErrors<EmployeeFormValues>;
  isSubmitting: boolean;
  isComplete: boolean;
  /* ...derived flags... */
}
```

`FieldErrors<T>` (not a hand-rolled `Record<string, ...>`) keeps `errors.codAngajat`
assignable to shadcn's `<FieldError errors={[...]}/>` and keeps `errors.root` typed.

## Step 5 — Render Props and HoC

Escape hatches, not defaults — see the rule for the exact criteria. Short version:

- Want to pass markup down? Use a named `ReactNode` slot (`pontaj`, `alocari`), which is
  what `AngajatDetail` does. Reach for a render prop only when the child needs a value the
  parent owns *and* varies per call site. Never across a Server→Client boundary.
- Want cross-cutting client behaviour? Use a hook. An HoC is justified only for a wrapper
  with no per-call variation (error boundary, analytics), never around a Server Component,
  and never for authorization — that lives in `server/authz/`.

## Step 6 — verify

```bash
pnpm check:fix     # biome; also fixes import order after the moves
pnpm typecheck     # must be 0 errors
pnpm lint          # eslint; compare error count to the pre-refactor baseline
```

`pnpm lint` has a pre-existing warning/error baseline in this repo — record the count
before you start and compare, rather than expecting zero. `react-hooks/incompatible-library`
on `watch()` is expected: React Compiler skips memoizing react-hook-form output.

Per `.claude/rules/ticket-invariant.md` this refactor is **Normal** tier: it needs an
`LS-####`, acceptance criteria, and the three commands above recorded in
`.planning/evidence/LS-####.md`.
