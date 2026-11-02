---
name: typescript-strict
description: Strict TypeScript rules for application code — strict mode, no any/@ts-ignore/enum, import type, explicit return types on exported functions and hooks, Use<Name>Return interfaces with no setters, discriminated unions on `ok` (ActionResult), branded date/period strings (MonthKey/IsoDate), and the TYPE-COMPOSITION rules — when to declare vs derive, one owner per shape, Pick/extends (never Omit) across a PII/financial DTO boundary, generics with constraints, `as const satisfies Record<Union, T>` for every union-keyed map, mapped and conditional types, Next.js's global PageProps<"/route">. Load when writing or reviewing TypeScript types, interfaces, hook signatures, exported function signatures, or when a new interface looks like one that already exists.
---

# TypeScript — strict application rules

This skill is the checklist. If the project has a long-form conventions doc, a type-duplication
gate or an ADR on types, it is the authority — see **Project bindings** and read those first.

Target baseline in non-test source: **0** `any`, **0** `@ts-ignore` / `@ts-expect-error`, **0**
`enum`. Measure the current counts before changing anything. Keep them at zero (or falling); a change
that adds one needs a comment naming the reason, and reviewers treat it as a design question, not a
lint nit.

## Project bindings

Resolve these from the host project (`package.json`, `tsconfig.json`, `CLAUDE.md`, `docs/`) before
applying the rules. Never invent a command or a path.

| Binding | What to look for | Default if absent |
|---|---|---|
| Typecheck command | `typecheck` script in `package.json` | `tsc --noEmit` (`next typegen && tsc --noEmit` on Next.js) |
| Shared types index | `src/types/index.ts` or a `@/types` alias | none — create only on the second consumer |
| Shared client-safe helpers | `src/lib/` (dates, options, pagination, action result) | `src/lib/` |
| Action result carrier | an existing `ActionResult` / `Result` type | the shape in §1 |
| Branded temporal types + parsers | `MonthKey`, `IsoDate`, `parse*` helpers | §1 shape, added on first need |
| Transaction / raw SQL helper | `Tx` type, `executeRows<TRow>` or equivalent | the ORM's own type, spelled in one file |
| DTO / authz boundary file | where PII/financial fields are stripped | the server-side authz or DTO module |
| Enforcement gates | scripts like `gate:hooks`, `gate:type-dupes`, `gate:dates` | review checklist (§6) only |

---

## 1. Baseline rules

| Rule | Detail |
|---|---|
| `strict: true` | No exceptions. No `any`; for an unknown value use `unknown` and narrow. |
| `import type` | For every type-only import. |
| Explicit return types | On every **exported** function, Server Action, service and hook. Local helpers may infer. |
| Path alias | `@/` (or the project's alias) across folders; relative only inside a component folder. |
| No `enum`, no `namespace` | Use a `const` array + derived union (§4.5). |
| `as unknown as` | Never at a call site. Put the one unavoidable cast in a helper (e.g. `executeRows<TRow>(tx, sql…)` for raw SQL rows) and comment every remaining seam (`globalThis`, `z.NEVER`, …). |

### Hook returns — declared, never inferred

Every behavioural hook declares `Use<Name>Return` in its folder's `types.ts`. **Never**
`type UseXReturn = ReturnType<typeof useX>` — the interface is a *prohibition*: it keeps
state-mutating members away from the view.

- Sanctioned: `control`, `register`, `errors`, `onSubmit`, `isSubmitting`, derived values.
- Forbidden: `handleSubmit`, `setValue`, `setError`, `reset`, `trigger`, `watch`, `formState`,
  any raw `set<Foo>`. Name the command (`onModeChange`), not the setter (`setMode`).
- **A shared base for hook returns is itself named `Use*Return`** (`UseGridSelectionReturn`,
  `UseClientTableReturn<TRow>`). A gate or reviewer finds contracts by that name, so a base called
  `GridSelection` would be a place a setter could hide.

### Result carriers — discriminate on `ok`

```ts
// the one carrier for Server Action / command results
export type ActionResult<TData extends object = NoData, TError = string, TCommon extends object = NoData> =
  (({ ok: true } & TData) | { ok: false; error: TError }) & TCommon;
```

Never discriminate a result on `status` — `status` is a domain field on too many rows. Instantiate
the carrier (`ActionResult<{ id: string }>`); do not hand-write a new `{ ok … }` union.

### Status state — discriminated unions

```ts
type SaveState = { status: "idle" } | { status: "saving" } | { status: "error"; message: string };
```

Pair with an exhaustive `switch` ending in `const _exhaustive: never = state;`.

### Temporal strings — branded

`MonthKey` (`"2026-03"`) / `IsoDate` (`"2026-03-14"`) as branded strings. Parse at the boundary
(`parseMonthKey`, `requireIsoDate`); never `x.split("-").map(Number)` at a call site. Entity ids
are usually deliberately **not** branded — the cost outweighs the catch rate; follow the project's
decision if one exists.

---

## 2. The composition rule — declare or derive?

> **Derive** when the source of truth is an implementation you control and the type is its shadow.
> **Declare** when the type *is* the contract — when it exists to constrain the implementation.

| Situation | Do |
|---|---|
| Form values from a zod schema | `z.infer<typeof schema>`, named `<Feature>FormValues` |
| Row type of an ORM table (server-only) | `typeof table.$inferSelect` (or equivalent), then `Pick` |
| Response of a service you own | the service's **exported named row type** first; `Awaited<ReturnType<typeof fn>>` only if none exists |
| Union of literals from a list you own | `(typeof LIST)[number]` |
| Hook return, action result, DTO, domain union | **declare** it |

---

## 3. One owner per shape

Before writing `interface Foo {`, search for the **shape**, not the name. Typical shared owners —
find the project's versions and import them, do not restate:

| Shape | Owner pattern |
|---|---|
| `{ from: string; to: string }` | `DateRange`. Domain names stay as aliases, and **the alias's doc states the boundary convention** (inclusive vs half-open). |
| `{ from: Date; to: Date }` | `InstantRange` |
| ORM transaction | `Tx`, or `TxOf<TSchema>` for a generic seam; the ORM's long type is spelled in one file only |
| Raw SQL rows | `executeRows<TRow>(tx \| db, sql…)` |
| Role | derived from a `ROLES` const array; never re-list the literals |
| `{ id; name }` option refs | `NamedOption`, `PersonOption`, … in one options module |
| Paged rows / page controls | `PagedRows<TRow>`; controls are `Omit<PagedRows<never>, "rows">` |
| Screen rows that also export | the export row type: screen and export are the SAME row (calculation parity) |

**A shared types index is the index, not the home.** It re-exports client-safe owners so there is
one import path; nothing is DECLARED there. A new shared shape gets its owner next to its source and
a line in the barrel, in the same change. Server-only types (`Tx`, DTOs) are never indexed. A test
that fails on a declaration, a runtime export, or a server re-export in the barrel keeps it honest.

**Same name in two files is a smell even when the shapes differ.** Two `ProjectOption`s or six
`FormValues` make "go to definition" lie. Prefix with the owner (`AddIncidentFormValues`).

**Never let a DTO `extends` a DB row type.** A column added to the SELECT would become a required
DTO field, the mapper would be forced to copy it, and it would ship to every viewer. DTOs chain among
themselves only (Public → Self → Admin).

**Hoist on the second consumer:** same feature → the feature's `types.ts`; second *feature* →
`src/lib/` (or the shared index); server-only → the owning service.

---

## 4. Which tool for which job

### 4.1 `Pick` / `extends` vs `Omit` — allowlist vs denylist

`Pick<T, K>` and `interface B extends A` are **allowlists**: a field added to the source does not
appear in the derived type. `Omit<T, K>` is a **denylist**: every future field appears automatically.

**Hard rule — across a PII or financial boundary (anything that strips a rate, a salary, a personal
email, a cost figure) never derive the narrower type with `Omit` from the wider one.** Build upwards:

```ts
// right — a new admin-only field cannot leak into the public DTO
export interface EmployeePublicDTO { id: string; displayName: string; /* … */ }
export interface EmployeeSelfDTO extends EmployeePublicDTO { personalEmail: string | null }
export interface EmployeeAdminDTO extends EmployeeSelfDTO { hourlyRate: string }

// wrong — adding `salaryNet` to Admin silently adds it to Public
type EmployeePublicDTO = Omit<EmployeeAdminDTO, "hourlyRate" | "personalEmail">;
```

Elsewhere `Omit` is fine when the sentence really is "all of X except":
`Omit<PagedRows<never>, "rows">`, `Omit<ComponentProps<"input">, "type">`.

### 4.2 Generics — when the *relationship* is the contract

Use a type parameter when two positions must agree, not to avoid writing a type. Constrain it.

```ts
// a column can only name a key the row actually has
export interface ExportColumn<TRow> { key: keyof TRow & string; header: string }
// accepts anything with the two keys it reads
export const toPickerOptions = <T extends { id: string; name: string }>(rows: T[]) => …
// every per-entity action reports its id plus its own payload
export type OrderActionResult<TExtra extends object = NoData> = ActionResult<OrderRef & TExtra>;
```

Signs a generic is wanted: two interfaces identical except for one field's type, or N copies of
`{ rows: X[]; total: … }`. Signs it is not: one call site, or a parameter that appears once
(`<T>(x: T): void` — use `unknown`). Two identical shapes with the *same* field types want a shared
interface, not a generic.

### 4.3 Unions — closed sets and "one of these shapes"

- Closed literal set → union derived from a `const` array (§4.5).
- Alternative shapes → discriminated union on a literal key (`ok`, `kind`, `status`).
- Never an optional-field bag. A result type with a dozen optional payloads lets any action
  structurally return any other's, and `result.tripId` compiles where it can never exist. Split it
  into one result type per action.

### 4.4 `satisfies` — check without widening

```ts
export const ALERT_PRIORITY = { … } as const satisfies Record<AlertType, number>;
```

**Required** for every map keyed by a domain union (labels, priorities, tab config, chart config):
a new union member without an entry becomes a compile error, and the literal types survive. Prefer
it over an annotation when the consumer benefits from the narrow literal type. Use `satisfies` on
object literals returned into a declared shape to catch excess keys at the construction site.

### 4.5 `as const` arrays → unions (instead of `enum`)

```ts
export const APP_ROLES = ["admin", "manager", "member"] as const;
export type AppRole = (typeof APP_ROLES)[number];
```

One array feeds the type, the zod `z.enum(APP_ROLES)`, and the UI option list. Query-key tuples are
`as const` too.

### 4.6 Mapped types — one shape per key of another

```ts
export type ExportRowShape<TRow> = { [K in keyof TRow]: string };
const HANDLERS: { [K in EntityType]: EntityHandler<RowByEntity[K]> } = { … };
```

Reach for one when you are about to write the same object type once per union member.
`Record<K, V>` is the mapped type for when `V` does not depend on `K`.

### 4.7 Conditional types — rarely, and at a seam

Use them for a library/generic seam (unwrapping, key extraction) — never to encode business rules,
which belong in a function with a test. If a conditional type needs a comment to read, a named
overload or two declared types are usually clearer.

### 4.8 Indexed access and `typeof` — follow a declared owner

`EmployeeAdminDTO["status"]`, `(typeof CATALOG)[number]["slug"]`, `Parameters<typeof fn>[0]`.
Point at one field of an owner instead of restating its literal union in three places.

---

## 5. Next.js route props (when the project uses Next.js ≥ 15.5)

Next generates global `PageProps<"/route">` and `LayoutProps<"/route">`. Use them instead of
hand-writing `{ params: Promise<{ id: string }> }` — the route literal is checked against the file
tree, so a renamed segment becomes a type error:

```ts
export default async function Page(props: PageProps<"/orders/[id]">) {
  const { id } = await props.params;
}
```

The globals live in generated `.next/types/`, usually gitignored, so the typecheck script must run
`next typegen` first. **Run the project's typecheck command, not bare `tsc`**, on a fresh checkout.
An inner Suspense section takes `PageProps<"/r">["params"]` or `Pick<PageProps<"/r">, "searchParams">`;
it does not restate `Promise<{ id: string }>`. Check `node_modules/next/dist/docs/` for the version.

---

## 6. Review checklist

- [ ] No new `any`, `@ts-ignore`, `enum`, `namespace`.
- [ ] Every new `interface`/`type` searched for an existing owner by **shape** (§3).
- [ ] No new same-name type in a second file.
- [ ] DTO narrowing is `Pick`/`extends`, not `Omit` (§4.1). No DTO extends a row type.
- [ ] Union-keyed maps use `as const satisfies Record<Union, T>` (§4.4).
- [ ] Hook return declared, no setters; actions return `ActionResult<…>`.
- [ ] Exported functions have explicit return types; type-only imports use `import type`.
- [ ] Route props use `PageProps<"/…">` (Next.js).
- [ ] The project's typecheck command and any type gates pass.
