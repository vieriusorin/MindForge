---
name: p4t-ui-shadcn
description: P4T UI component rules: shadcn/ui only added via pnpm dlx shadcn CLI, never hand-copied; the shadcn Form wrapper is NOT installed so FormField/FormProvider/useFormContext will not compile; forms use the Field family (Field, FieldLabel with explicit htmlFor, FieldError with an errors array prop, data-invalid) wired to react-hook-form by hand; register vs Controller; TanStack Table for interactive tables; size="touch" for on-site screens; lucide-react icons; Romanian labels. Load before building or editing any form, table, or component using shadcn primitives.
---

# UI Components — shadcn/ui

**shadcn/ui is the component layer for this project.** Do not introduce a second
component library (MUI, Chakra, Ant, Mantine, HeroUI, Radix-wrapped alternatives).

## Install components via the CLI — always

Components are added with the CLI, never hand-written into `components/ui/` and
never copy-pasted from the docs by hand.

```bash
# one-time init (already done after the foundation phase)
pnpm dlx shadcn@latest init

# add components
pnpm dlx shadcn@latest add button input field table dialog
```

Reasons this is a hard rule:

- The CLI writes the component, its dependencies, and the required Radix packages
  in one step. Hand-copying reliably misses a peer dependency or a `cn()` import.
- It keeps `components.json` (aliases, style, base colour, icon library) as the
  single source of truth so every component lands in the same place with the same
  conventions.
- It resolves the correct variant for the installed Tailwind and React versions.
  A snippet pasted from a blog post is frequently a version behind.

If a component is genuinely not in the registry, build it in
`components/` (NOT `components/ui/`) using the same Radix + `cva` + `cn()`
conventions the generated components use.

## Rules

### Never edit generated files to "fix" a one-off
`components/ui/*` is owned code — editing it IS the intended workflow for
changing a component's behaviour project-wide. But a one-screen tweak belongs in
the consuming component via `className`, not in the shared primitive.

### Compose, don't fork
Need a variant? Extend the existing `cva` variants in the primitive. Do not
create `button-2.tsx`.

### Forms go through the `Field` family, wired to react-hook-form by hand

**The shadcn `Form` wrapper is not installed in this repo and must not be reached for.**
`src/components/ui/form.tsx` does not exist, and `src/` contains zero references to
`FormField`, `FormProvider` or `useFormContext`. Code written against `Form` / `FormField` /
`FormLabel` / `FormControl` / `FormMessage` will not compile here, and adding that wrapper
now would fork the form layer in two.

The house pattern is the shadcn **`Field`** family from `@/components/ui/field` — `FieldSet`,
`FieldLegend`, `FieldGroup`, `Field`, `FieldLabel`, `FieldDescription`, `FieldError`,
`FieldContent`, `FieldTitle`, `FieldSeparator` — driven directly by `react-hook-form` +
`zodResolver`. These are registry components, so the CLI rule above is unchanged — they are
added with `pnpm dlx shadcn@latest add …`, never hand-copied. (Check the current registry for
the component name before running it; this project is on the non-default `radix-maia` style,
so resolve the variant through the CLI rather than assuming a slug or pasting from the docs.)

```tsx
<Field data-invalid={Boolean(errors.nume)}>
  <FieldLabel htmlFor="nume">Nume șantier</FieldLabel>
  <Input id="nume" size="touch" {...register("nume")} />
  <FieldError errors={errors.nume ? [errors.nume] : undefined} />
</Field>
```

Reference forms: `modules/santiere/components/santier-form.tsx` is the reference for the **full
shape** (register + `Controller` side by side, with `data-invalid`).
`modules/admin/components/alerte-section/` is the reference for **hook extraction only** (the RHF
call lifted into `hooks/use-alerte-section.ts` per `react-client-patterns.md`) — note its
`<Field>`s do not currently set `data-invalid`, so do not copy its field markup.

**`FieldLabel` does not associate itself with anything — that is the one thing to get right.**
Unlike shadcn's `FormLabel`, which reads a generated id out of `FormField`'s context, `FieldLabel`
is a bare `Label` with a `data-slot` attribute: there is no context provider, no generated ids,
and no `htmlFor` wiring. Association is entirely manual, and getting it wrong is silent — the
label still renders, it just stops naming the control for a screen reader and stops moving focus
on click.

So: **every `FieldLabel` that labels a control carries an explicit `htmlFor`, and that control
carries the matching `id`** — including a control rendered through `Controller`, where the `id`
is forwarded to the rendered component (`<Checkbox id="isInternal" …>`,
`<LocalitateCombobox id="localitate" …>`).

Two cases sit outside that rule, and both exist in the tree today — stated here so the rule is
honest rather than aspirational:

- **A `FieldLabel` captioning static read-only text** (`<FieldLabel>Angajat</FieldLabel>` above a
  `<p>`) has nothing to associate with. Genuinely exempt.
- **A `FieldLabel` over a `disabled readOnly` `<Input>` with no `id`.** `disabled` already removes
  the control from the interactive accessibility tree, so nothing is lost in practice — but it is
  a dangling label, not an exemption on the merits. Prefer giving it an `id` when you touch the
  file.

Audited at the time of writing (LS-0140): of the three `FieldLabel`s without a matching target,
two were the sanctioned static-text case — `employees/components/employee-form.tsx` ("Tarif
orar" over a `<p>`) and `santiere/components/edit-allocation-dialog.tsx` ("Angajat" over a
`<p>`). The third, the `disabled readOnly` Input in
`request-type-dialog/components/request-type-edit-form.tsx`, was given an `id` and a matching
`htmlFor`. Every `FieldLabel` in the tree now either associates or captions static text.

The rest of the family's contract, because it differs from what a shadcn `Form` reader expects:

- **`FieldError` is driven by an `errors` array prop**, not by a message string:
  `errors={errors.x ? [errors.x] : undefined}` is the house form. It de-duplicates by message,
  renders one message bare and several as a list, and returns `null` when there is nothing to
  say. (It also accepts children, which win over `errors` — `alerte-section.tsx` uses that for
  a field rendered from a descriptor loop. Prefer the `errors` prop; children give up the
  de-duplication.) Either way it carries `role="alert"`, so error *announcement* is handled for
  you — unlike association.
- **`data-invalid={Boolean(errors.x)}` on `<Field>`** is what arms the
  `data-[invalid=true]:text-destructive` variant. Without it the field renders valid-looking
  while showing an error.
- **`register(...)` for native inputs, `Controller` for everything else** — `Checkbox`,
  `DateField`, and the comboboxes are controlled and cannot take a `register` spread.
- Validation errors and labelling are consistent across the app only because every form
  repeats this shape. It is a convention held by discipline, not by a wrapper component.

Client-side RHF validation stays UX, not a boundary: the Server Action re-parses with the real
`.strict()` schema regardless (`nextjs-data.md` §6).

### Tables
Use shadcn `Table` primitives with TanStack Table for anything with sorting,
filtering, or pagination. Plain `Table` alone only for static, small,
non-interactive lists.

### Field sizing for on-site use
The pontaj screens and any other flow used on a phone at a șantier must use
larger touch targets than the shadcn default. Define these as variants on the
primitive (e.g. `size="touch"`), not as ad-hoc `className` overrides scattered
across screens.

### Romanian labels
All user-facing strings in components are Romanian. Component *code* (props,
variants, file names) stays English.

### Icons
`lucide-react` — the shadcn default. Do not add a second icon set.

## After running the CLI

Generated components are normal project code: they are reviewed, committed by the
developer (per `no-commit.md`), and subject to the same TypeScript rules in
`typescript.md` — including explicit return types on anything exported that is not
a plain component.
