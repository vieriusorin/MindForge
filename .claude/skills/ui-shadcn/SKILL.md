---
name: ui-shadcn
description: shadcn/ui component rules — components only added via the shadcn CLI, never hand-copied; check whether the shadcn Form wrapper is installed, and if not, never reach for FormField/FormProvider/useFormContext — use the Field family (Field, FieldLabel with explicit htmlFor, FieldError with an errors array prop, data-invalid) wired to react-hook-form by hand; register vs Controller; TanStack Table for interactive tables; touch-size variants for mobile/field screens; lucide-react icons; labels in the project's UI language. Load before building or editing any form, table, or component using shadcn primitives.
---

# UI Components: shadcn/ui

**shadcn/ui is the component layer.** Don't introduce a second component library (MUI, Chakra,
Ant, Mantine, HeroUI, Radix-wrapped alternatives).

## Project bindings

| Binding | What to look for | Default if absent |
|---|---|---|
| CLI command | Package manager from the lockfile | `pnpm dlx` / `npx` / `bunx` `shadcn@latest` |
| Style, aliases, ui dir | `components.json` | Ask before running `init` |
| Form layer | Does `components/ui/form.tsx` exist? Grep for `FormField`, `FormProvider`, `useFormContext` | Not installed → Field family (below) |
| Field family | `components/ui/field.tsx` | Add it via the CLI |
| Touch variant | A `size="touch"` (or similar) variant on Input/Button | Add one when the first mobile screen needs it |
| UI language | `CLAUDE.md`, i18n dictionaries, existing labels | English |
| Reference forms | One form that uses register + `Controller` + `data-invalid` correctly | Write one; it becomes the reference |

## Install components with the CLI, always

Add components with the CLI. Never hand-write them into `components/ui/`, and never paste them
from the docs.

```bash
<pm-dlx> shadcn@latest init        # one-time
<pm-dlx> shadcn@latest add button input field table dialog
```

Why this is a hard rule:

- The CLI writes the component, its dependencies and the required Radix packages in one step.
  Hand-copying reliably misses a peer dependency or a `cn()` import.
- It keeps `components.json` (aliases, style, base colour, icon library) as the single source of
  truth.
- It resolves the right variant for the installed Tailwind/React versions and the configured
  style. A pasted snippet is often a version behind. On a non-default style, resolve names
  through the CLI rather than assuming a slug.

If a component really isn't in the registry, build it in `components/` (NOT `components/ui/`)
with the same Radix + `cva` + `cn()` conventions.

## Rules

### Don't edit generated files to fix a one-off
`components/ui/*` is owned code. Editing it is the right way to change a primitive across the
whole project. A one-screen tweak belongs in the consumer, via `className`.

### Compose, don't fork
Need a variant? Extend the primitive's `cva` variants. Do not create `button-2.tsx`.

### Forms: check the form layer first

If the shadcn `Form` wrapper **is** installed and used, follow it. If it **is not**, don't reach
for it: code written against `Form`/`FormField`/`FormLabel`/`FormControl`/`FormMessage` won't
compile, and adding the wrapper later splits the form layer in two. Use the **`Field`** family
instead (`FieldSet`, `FieldLegend`, `FieldGroup`, `Field`, `FieldLabel`, `FieldDescription`,
`FieldError`, `FieldContent`, `FieldTitle`, `FieldSeparator`). Drive it directly with
`react-hook-form` + `zodResolver`, and add it through the CLI like any other component.

```tsx
<Field data-invalid={Boolean(errors.name)}>
  <FieldLabel htmlFor="name">Project name</FieldLabel>
  <Input id="name" size="touch" {...register("name")} />
  <FieldError errors={errors.name ? [errors.name] : undefined} />
</Field>
```

**`FieldLabel` does not associate itself with anything. This is the one thing to get right.**
Unlike `FormLabel`, which reads a generated id from `FormField`'s context, `FieldLabel` is a bare
`Label`. There's no context, no generated id and no `htmlFor` wiring. A wrong association fails
silently: the label still renders, but screen readers no longer announce it as the control's name
and clicking it no longer moves focus.

So **every `FieldLabel` that labels a control carries an explicit `htmlFor`, and the control
carries the matching `id`**. That includes controls rendered through `Controller`, where the `id`
is forwarded (`<Checkbox id="isInternal" …>`, `<Combobox id="city" …>`).

Two honest exceptions:

- **A `FieldLabel` captioning static read-only text** (a label over a `<p>`) has nothing to
  associate with. It is exempt.
- **A `FieldLabel` over a `disabled readOnly` input with no `id`.** Nothing is lost in practice,
  but it's a dangling label. Give the input an `id` when you touch the file.

When auditing, grep every `FieldLabel` and confirm it either associates with a control or
captions static text.

The rest of the family's contract, which differs from what a `Form` user expects:

- **`FieldError` takes an `errors` array prop**, not a message string:
  `errors={errors.x ? [errors.x] : undefined}`. It de-duplicates by message, renders one message
  bare and several as a list, and returns `null` when there's nothing to show. Children also work
  and take priority, but they lose the de-duplication. It carries `role="alert"`, so errors are
  announced for you. Label association is not.
- **`data-invalid={Boolean(errors.x)}` on `<Field>`** switches on the
  `data-[invalid=true]:text-destructive` styling. Without it, a field showing an error still
  looks valid.
- **`register(...)` for native inputs, `Controller` for everything else.** Checkboxes, date
  fields and comboboxes are controlled and can't take a `register` spread.
- Labels and validation errors look the same across the app only because every form repeats this
  shape. Nothing enforces it but discipline.

Client-side RHF validation is UX, not a security boundary. The server action re-parses with the
real `.strict()` schema regardless (see `nextjs-data`).

### Tables
Use shadcn `Table` primitives with TanStack Table for anything with sorting, filtering or
pagination. Use plain `Table` alone only for small, static, non-interactive lists.

### Field sizing for mobile and field use
Screens used on a phone in the field, often one-handed or with gloves, need bigger touch targets
than the shadcn default. Define these as variants on the primitive (e.g. `size="touch"`), not as
`className` overrides scattered across screens.

### UI language
Every user-facing string is in the project's UI language (see bindings). Component *code*
(props, variants, file names) stays English.

### Icons
`lucide-react`, the shadcn default. Do not add a second icon set.

## After running the CLI

Generated components are normal project code: they get reviewed, are committed by the developer,
and follow the same TypeScript rules (`typescript-strict`), including explicit return types on
anything exported that is not a plain component.
