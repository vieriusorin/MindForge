---
name: forms-rhf-zod
description: MindForge form pattern — react-hook-form + @hookform/resolvers zodResolver + the shadcn Field family + a Server Action called through useMutation. One zod schema in src/features/<f>/schemas.ts shared by the resolver and the action; typed input/output inference (no hand-written generics); register vs Controller for Select/Checkbox/RadioGroup; server field errors via formErrorFromZod/applyFormError from src/lib/action-result.ts; root errors; navigation and refresh in the hook; useWatch/useFieldArray inside the hook with intent-named returns. The worked reference is create-group-form. Load before creating or editing any form, form hook, schemas.ts, or a form-backing Server Action.
---

# Forms: react-hook-form + zod + shadcn `Field` + `useMutation`

Contract: `.claude/rules/state-and-data.md` §3 and §6; hook-return limits:
`react-client-patterns.md` rule 6; `Field` family details: `ui-shadcn`.

**Installed:** `react-hook-form` 7.x, `@hookform/resolvers` 7.x (`zodResolver` supports zod 4
and infers `Resolver<z.input, ctx, z.output>`), `zod` 4.x. **No shadcn `Form` wrapper.** Never
add it, never use `FormField` / `FormProvider` / `useFormContext`.

**Reference implementation (read it, copy its shape):**
`src/features/groups/{schemas.ts,actions.ts,types.ts}` +
`src/features/groups/components/create-group-form/`.

## The five files

| File | Holds | Never holds |
|---|---|---|
| `src/features/<f>/schemas.ts` | the zod schema + `z.input` type | `"use server"`, server imports |
| `src/features/<f>/actions.ts` | `"use server"`; auth → `Schema.safeParse(input)` → write → `ActionResult` | the schema itself (a `"use server"` file may export only async functions) |
| `src/features/<f>/types.ts` | `FormActionResult<{ id }, Values>` alias | — |
| `components/<name>/hooks/use-<name>.ts` | `useForm`, `useMutation`, `router`, error mapping | JSX |
| `components/<name>/<name>.tsx` | `Field` markup bound to `register` / `Controller` | `useState`, `handleSubmit`, `setError` |

## 1. Schema: one source of truth

```ts
// src/features/groups/schemas.ts
import { z } from "zod";

export const CreateGroupInput = z.strictObject({
  name: z.string().trim()
    .min(1, "Give the group a name.")
    .max(80, "Keep the name under 80 characters."),
  packSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Pick a learning pack."),
});

export type CreateGroupValues = z.input<typeof CreateGroupInput>;
```

- **Messages are user-facing UI copy.** Write them the way the screen should say them.
- `z.strictObject` so the action rejects unexpected keys.
- Use `z.input` for form values (what the fields hold) and `z.output` for what the action
  receives after transforms. With no transforms they're the same. With `.transform()` or
  `z.coerce`, they differ, and the resolver types both for you.
- Numbers from `<Input type="number">`: `register("x", { valueAsNumber: true })` +
  `z.number()`. Don't use `z.coerce.number()`, because it turns `""` into `0`.

## 2. Action: re-validate, return a result

```ts
// src/features/groups/actions.ts
"use server";
export async function createGroup(input: unknown): Promise<CreateGroupResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/groups");            // auth guard: redirect is fine here

  const parsed = CreateGroupInput.safeParse(input);        // the real boundary
  if (!parsed.success)
    return { ok: false, error: formErrorFromZod(parsed.error) };  // → per-field messages

  // domain checks the schema can't express → map to the field that explains them
  if (!packs.some((p) => p.slug === parsed.data.packSlug))
    return { ok: false, error: { message: "Pick a learning pack.",
                                  fieldErrors: { packSlug: "Pick a learning pack." } } };

  const { data, error } = await supabase.rpc("create_group", { … });
  if (error || !data)
    return { ok: false, error: { message: "Could not create the group. Try again." } };
  return { ok: true, groupId: data };                      // no redirect: the hook navigates
}
```

`input: unknown`, not `CreateGroupValues`. The TypeScript type is a client-side promise and
the action is a public POST endpoint. Never return raw DB error text.

## 3. Hook: all behaviour

```ts
// components/create-group-form/hooks/use-create-group-form.ts
"use client";
export interface UseCreateGroupFormReturn {
  control: Control<CreateGroupValues>;
  register: UseFormRegister<CreateGroupValues>;
  errors: FieldErrors<CreateGroupValues>;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => Promise<void>;
  isSubmitting: boolean;
}

export function useCreateGroupForm(defaultPackSlug: string): UseCreateGroupFormReturn {
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(CreateGroupInput),               // types inferred: no <generics>
    defaultValues: { name: "", packSlug: defaultPackSlug }, // EVERY field, never undefined
  });

  const mutation = useMutation({
    mutationFn: createGroup,
    onSuccess: (result) => {
      if (!result.ok) {
        applyFormError(form.setError, result.error);       // fields, or root.server
        return;
      }
      router.push(`/groups/${result.groupId}`);
    },
    onError: () => {                                       // network / thrown: not a validation issue
      form.setError("root.server", { type: "server",
        message: "Could not reach the server. Try again." });
    },
  });

  return {
    control: form.control,
    register: form.register,
    errors: form.formState.errors,
    onSubmit: form.handleSubmit((values) => mutation.mutate(values)),
    isSubmitting: mutation.isPending || mutation.data?.ok === true, // covers the navigation
  };
}
```

- `handleSubmit`, `setError`, `reset`, `setValue`, `watch` stay **inside** the hook
  (`react-client-patterns.md` rule 6). The view gets `onSubmit`, not `handleSubmit`.
- Pending state comes from `mutation.isPending`, not `formState.isSubmitting`, because
  `mutate` doesn't return a promise to `handleSubmit`.
- Success that stays on the page: `form.reset()` in `onSuccess`, plus
  `queryClient.invalidateQueries(...)` and/or `router.refresh()` to show the new row (see
  `client-data-tanstack-query` §5).

## 4. View: `Field` markup only

```tsx
<form onSubmit={onSubmit} noValidate>                     {/* noValidate: zod owns messages */}
  <FieldGroup>
    {/* native input → register */}
    <Field data-invalid={Boolean(errors.name)}>
      <FieldLabel htmlFor="group-name">Group name</FieldLabel>
      <Input id="group-name" aria-invalid={Boolean(errors.name)} {...register("name")} />
      <FieldError errors={errors.name ? [errors.name] : undefined} />
    </Field>

    {/* Radix control → Controller; forward id, ref, onBlur */}
    <Controller control={control} name="packSlug" render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor="pack">Learning pack</FieldLabel>
        <Select name={field.name} value={field.value} onValueChange={field.onChange}>
          <SelectTrigger id="pack" aria-invalid={fieldState.invalid}
                         onBlur={field.onBlur} ref={field.ref}>
            <SelectValue placeholder="Choose a pack" />
          </SelectTrigger>
          <SelectContent>{/* SelectItem … */}</SelectContent>
        </Select>
        <FieldError errors={fieldState.error ? [fieldState.error] : undefined} />
      </Field>
    )} />

    {/* form-level server message */}
    <FieldError errors={errors.root?.server ? [errors.root.server] : undefined} />
    <Button type="submit" disabled={isSubmitting}>
      {isSubmitting ? "Creating…" : "Create group"}
    </Button>
  </FieldGroup>
</form>
```

Every field repeats the same four things: `data-invalid` on `Field`, `htmlFor` = `id`,
`aria-invalid` on the control, and `FieldError` with an **array**.

### Other installed controls

```tsx
// Checkbox (boolean)
<Controller control={control} name="isPublic" render={({ field }) => (
  <Field orientation="horizontal">
    <Checkbox id="is-public" checked={field.value}
              onCheckedChange={(v) => field.onChange(v === true)} ref={field.ref} />
    <FieldLabel htmlFor="is-public">Visible to the group</FieldLabel>
  </Field>
)} />

// RadioGroup (one of N) — FieldSet + FieldLegend, each item labelled
<Controller control={control} name="mode" render={({ field, fieldState }) => (
  <FieldSet data-invalid={fieldState.invalid}>
    <FieldLegend>Mode</FieldLegend>
    <RadioGroup value={field.value} onValueChange={field.onChange}>
      {MODES.map((m) => (
        <Field key={m.value} orientation="horizontal">
          <RadioGroupItem id={`mode-${m.value}`} value={m.value} />
          <FieldLabel htmlFor={`mode-${m.value}`}>{m.label}</FieldLabel>
        </Field>
      ))}
    </RadioGroup>
    <FieldError errors={fieldState.error ? [fieldState.error] : undefined} />
  </FieldSet>
)} />
```

A control that isn't installed (`textarea`, `switch`, `combobox`, …): `pnpm dlx shadcn@latest
add <name>` first (`ui-design.md` §1).

## 5. Harder cases, still inside the hook

| Need | In the hook | Exposed to the view |
|---|---|---|
| Show/hide a field from another field's value | `const kind = useWatch({ control: form.control, name: "kind" })` | `showPackField: kind === "pack"` |
| Repeating rows | `const rows = useFieldArray({ control: form.control, name: "options" })` | `rows: rows.fields`, `addOption()`, `removeOption(i)` |
| Cross-field rule (`end > start`) | `.refine(…, { path: ["end"] })` / `.superRefine` in the schema | nothing new: lands on `errors.end` |
| Async uniqueness (name taken) | in the **action**, returned as `fieldErrors.name` | nothing new |
| Values from the URL | read nuqs in the hook, put into `defaultValues` | — |
| Pure derivations (totals, labels) | `utils.ts` + `__tests__/utils.test.ts` | the derived value |

## 6. Anti-patterns

| Don't | Do |
|---|---|
| `useActionState` / `<form action={serverAction}>` for a new form | RHF + `useMutation` |
| `useForm<Values>()` with hand-written generics | let `zodResolver(Schema)` infer |
| Schema written twice (form + action) | `schemas.ts`, imported by both |
| `action(prev, formData: FormData)` + `formData.get` | `action(input: unknown)` + `Schema.safeParse` |
| `redirect()` on success inside a mutation's action | return the id; `router.push` in `onSuccess` |
| `FieldError` given a string | `errors={[err]}` |
| `FieldLabel` without `htmlFor` | match the control's `id` (Controller too) |
| `{...register("x")}` on `Select` / `Checkbox` | `Controller` |
| Rendering `error.message` from a thrown error | fixed user-facing text in `onError` |
| `useState` mirroring a field value | `useWatch` in the hook |
| `defaultValues` missing a field | every field defined (uncontrolled → controlled warning) |
