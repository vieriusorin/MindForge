---
name: react-component-split
description: Refactor a React / Next.js page or component into container / presentational / hook / types / utils files. Use when a component mixes fetching, role gating, form state and markup; when asked to "extract a hook", "separate concerns", "move the interfaces out", or to apply Container/Presentational, Render Props or HoC patterns.
---

# React Component Split

The contract is the `react-client-patterns` skill. If the project also has a normative rule file
for this (e.g. `.claude/rules/react-client-patterns.md`), that file wins on any conflict; this
skill is the how-to with a worked before/after.

## Project bindings

Resolve before moving a line — from `CLAUDE.md` / `AGENTS.md`, `package.json`, the codebase.

| Binding | What to look for | Default if absent |
|---|---|---|
| Feature UI root | where feature components live | `src/modules/<f>/` |
| Shared validation | where route/searchParams parsers live | `src/lib/validation/` |
| Authz DTOs | where role-stripped DTO types are defined | `src/server/authz/dto.ts` |
| Figures engine | home of derived business figures | see `react-feature-architecture` |
| Verify commands | format/fix, typecheck, lint scripts in `package.json` | `tsc --noEmit` + the project linter |
| Layout gate | a script enforcing the component layout or hook returns | none — if one exists, run it |
| Ticket rules | does the project require a ticket ID + evidence for refactors? | see `ticket-traceability` |
| Reference split | an already-split component in this repo | the example below |

## Step 0 — classify the file first

Answer two questions before moving a line:

1. **Does it have `"use client"`?**
   - No → it is a Server Component. **Hooks are illegal here.** Its logic (auth, reads,
     role gates, `notFound()`) stays put; only *markup* and *types* move out.
   - Yes → behaviour moves to a hook.
2. **Is it a page (`app/**/page.tsx`)?**
   - Yes → it is the container. Never create a `*-container.tsx` beside it.

Do not skip step 0. Extracting a "hook" from a Server Component is the single most common way
this refactor goes wrong.

## Step 1 — the per-component folder

Each component gets its own folder under `components/<name>/`. Everything for that one component
is colocated; a barrel `index.ts` keeps the import path `@/<ui-root>/<f>/components/<name>`
stable. The container page stays where it is.

```
app/(dashboard)/settings/page.tsx                     container: params, auth, reads, gates
<ui-root>/settings/components/alerts-section/
  index.ts                                            barrel → AlertsSection
  alerts-section.tsx                                  presentational form (markup only)
  hooks/use-alerts-section.ts                         client behaviour (wiring)
  utils.ts                                            pure helpers (field descriptors)
  types.ts                                            boundary types for this component
```

Relative imports inside the folder: component → `./types`, `./utils`, `./hooks/use-<name>`;
hook → `../types`, `../utils`; utils → `./types`.

### Child components → a nested `components/` subfolder

When the component splits into smaller **presentational sub-components** (a row, a badge
cluster, a confirm dialog, one of several forms a dialog switches between), the child `.tsx`
files go in a `components/` subfolder **inside** the component's folder. The parent stays at
the root. No barrel for the children — the parent imports each by path; they are folder-internal.

```
<ui-root>/admin/components/invite-user-dialog/
  index.ts                              barrel → InviteUserDialog
  invite-user-dialog.tsx                container: the Dialog shell + mode switch
  hooks/use-invite-user-dialog.ts       the form hooks
  utils.ts                              zod schemas + inferred form-value types
  types.ts                              boundary types (props of parent AND children)
  components/                           ← child presentational pieces
    invite-user-create-form.tsx
    invite-user-edit-form.tsx
```

From a child: sibling → `./<other-child>`; up → `../types`, `../utils`, `../hooks/use-<name>`.
A child's props interface still lives in the folder's single `types.ts`.

**Shared → hoist up.** A type or pure helper used by a *second* component in the same feature
moves out to `<ui-root>/<f>/types.ts` or `<ui-root>/<f>/utils/<surface>.ts`. Promote on the
second consumer, not before. The shared `lib/` is for what a second *feature* imports.

## Step 2 — what moves out of a Server Component page

Move: the presentational wrapper (`UserDetail`) → `components/`, its props interface →
`types.ts`, param parsing → the shared validation module as a **pure** function.

Keep in the page: `await params` / `await searchParams`, the identity/session lookup,
`Promise.all([...])`, `notFound()` / `redirect()`, every role-derived boolean, the slot wiring.

Trap: a `Date.now()` moved into an RSC body trips `react-hooks` →
`Error: Cannot call impure function during render`. Read the clock once
(`const today = new Date().toISOString().slice(0, 10)`) and pass it into pure helpers:

```ts
// <shared-validation>/report-params.ts
export const trailingWindowStart = (today: string, days: number): string => ...
export const parseTrailingRange = (from: unknown, to: unknown, opts: {...}): ReportRange => ...
```

## Step 3 — extracting the hook (client only)

Everything that is not JSX goes in. For a `user-form.tsx` that is: schema selection,
`defaultValues`, `useForm`, the `requiredFieldNames`/`watch()` completeness gate, and the
`handleSubmit` body with its Server Action call, `toast`, and `router` navigation.

Before:

```tsx
export function UserForm({ mode, user }: UserFormProps) {
  const router = useRouter();
  const isCreate = mode === "create";
  const schema = isCreate ? userCreateSchema : ...;
  const { control, register, handleSubmit, setError, watch, formState } = useForm(...);
  const onSubmit = handleSubmit(async (values) => { ... });
  return <form onSubmit={onSubmit}> ...200 lines... </form>;
}
```

After:

```tsx
export function UserForm({ mode, user }: UserFormProps) {
  const { control, register, onSubmit, errors, isSubmitting, isComplete,
          isCreate, isAdminViewer, hasContactSection, rateLabel } =
    useUserForm({ mode, user });

  return <form onSubmit={onSubmit}> ...markup only... </form>;
}
```

Two things make this a real split rather than a move:

- **`onSubmit` is already wrapped.** The hook returns the bound handler, not `handleSubmit` +
  `setError`. The view cannot set form state.
- **Derived values are returned, not their inputs.** `rateLabel: string | null` replaced an
  inline `isAdminViewer && user && "hourlyRate" in user ? formatRate(user.hourlyRate) : null`
  in JSX. A *boolean* would not have been enough: the view would still need
  `user && "hourlyRate" in user` for TypeScript to narrow. When a flag leaves a narrowing
  guard in the markup, return the finished value instead of the flag.

Keep `"use client"` at the top of the hook file. It does not stop a Server Component importing
the module — that fails later, when `useForm` runs during a server render. It marks the
boundary for readers and the bundler.

## Step 3b — push the pure decisions down into `utils`

Once the hook exists, most of it is usually not wiring. Anything with no React in it — gates,
schema selection, defaults, required-field lists, completeness checks — moves again, to the
component's `utils.ts` (or `<ui-root>/<f>/utils/<surface>.ts` once shared):

```ts
// no React, no I/O, no clock
export const getUserFormGates = (mode, user): UserFormGates => ...
export const pickUserFormSchema = ({ isCreate, isAdminViewer }) => ...
export const buildUserFormDefaults = (user, { hasContactSection }) => ...
export const getRequiredUserFields = ({ isCreate, isAdminViewer }) => ...
export const isUserFormComplete = (values, requiredFields) => ...
```

The hook shrinks to what it is actually for:

```ts
const gates = getUserFormGates(mode, user);
const { control, register, handleSubmit, setError, watch, formState } = useForm({
  resolver: zodResolver(pickUserFormSchema(gates)),
  defaultValues: buildUserFormDefaults(user, gates),
  mode: "onChange",
});
const isComplete = isUserFormComplete(watch(), getRequiredUserFields(gates));
```

Every `utils.ts` export gets a test in `__tests__/utils.test.ts` asserting the *decision* — this
is where the split pays off, especially when no component test library is installed. A
`utils.ts` created only to satisfy the layout is a violation.

Do not move impure things there — a clock read, a `fetch`, a Server Action call, or anything
calling a `use*` hook stays in the hook. Do not pre-promote to the shared `lib/`.

Server side, the equivalent is the services layer; add `services/<f>/utils/` only when a second
service in the feature needs the helper. The hard exception is any figure also shown elsewhere
(export, report, chart) — it stays in the figures engine, called by every surface, or screen and
export drift.

## Step 4 — types.ts

Move only what crosses a boundary: props interfaces, the hook's `Use<Name>Return`, the
form-values shape. Import DTOs, do not redeclare them:

```ts
import type { UserDTO } from "@/server/authz/dto";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";

export interface UseUserFormReturn {
  control: Control<UserFormValues>;
  register: UseFormRegister<UserFormValues>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  errors: FieldErrors<UserFormValues>;
  isSubmitting: boolean;
  isComplete: boolean;
  /* ...derived flags... */
}
```

`FieldErrors<T>` (not a hand-rolled `Record<string, ...>`) keeps `errors.email` assignable to
shadcn's `<FieldError errors={[...]}/>` and keeps `errors.root` typed.

## Step 5 — Render Props and HoC

Escape hatches, not defaults — see `react-client-patterns` for the exact criteria. Short version:

- Want to pass markup down? Use a named `ReactNode` slot (`tasks`, `assignments`). Reach for a
  render prop only when the child needs a value the parent owns *and* varies per call site.
  Never across a Server→Client boundary.
- Want cross-cutting client behaviour? Use a hook. An HoC is justified only for a wrapper with no
  per-call variation (error boundary, analytics), never around a Server Component, and never for
  authorization — that is asserted server-side.

## Step 6 — verify

Run the project's own scripts (bindings), typically:

```bash
<format-fix>       # also fixes import order after the moves
<typecheck>        # must be 0 errors
<lint>             # compare error count to the pre-refactor baseline
<layout-gate>      # if the project has one
```

If lint has a pre-existing baseline, record the count before you start and compare rather than
expecting zero. `react-hooks/incompatible-library` on `watch()` is expected: React Compiler
skips memoizing react-hook-form output.

If the project uses `ticket-traceability`, this refactor is **Normal** tier: a ticket ID,
acceptance criteria, and the commands above recorded in its evidence file.
